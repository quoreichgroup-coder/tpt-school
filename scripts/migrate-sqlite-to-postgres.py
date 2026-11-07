#!/usr/bin/env python3
"""Safely merge the legacy SQLite school data into the Compose PostgreSQL DB.

Default mode runs the complete import in a transaction and rolls it back.
Use --apply only after reviewing the count-only dry-run report and creating
both required backups. Personal record values are never printed.
"""
import argparse
import hashlib
import re
import sqlite3
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_SOURCE = ROOT / "dev.db"
SKIP_TABLES = {"_prisma_migrations", "Session", "LoginAttempt", "VerificationToken"}
SECRET_SETTINGS = {
    "smtpPass", "resendApiKey", "mailjetApiKey", "mailjetSecret",
    "sendgridApiKey", "aiApiKey",
}
SETTING_INTERNAL = {"id", "createdAt", "updatedAt", "lastSessionCleanup"}
# Parent/child tables must be staged and inserted in FK order.
TABLE_ORDER = [
    "SchoolSettings", "User", "AcademicYear", "Term", "Room", "Staff", "Student", "Parent",
    "StudentParent", "StudentNote", "Document", "WaitlistEntry",
    "EnrolmentRequest", "Class", "ClassTeacher", "ClassEnrolment",
    "TimetableRequirement", "TimetableSlot", "Attendance", "Gradebook",
    "Grade", "ReportCard", "Notice", "NoticeRead", "Message",
    "MessageRecipient", "EmailLog", "AttendanceCode", "AttendanceCodeUsage",
    "FeeType", "FeeInvoice", "FeeInvoiceItem", "FeePayment", "StudentExit",
    "StudentTransferIn", "BehaviourIncident", "Suspension", "TruancyAlert",
    "SchoolEvent", "AuditLog", "LeaveRequest", "StaffAttendance",
]


def psql(sql: str) -> str:
    result = subprocess.run(
        ["docker", "compose", "exec", "-T", "db", "psql", "-X", "-v", "ON_ERROR_STOP=1", "-U", "tpt", "-d", "tpt_school", "-At", "-c", sql],
        cwd=ROOT, text=True, capture_output=True, check=True,
    )
    return result.stdout.strip()


def pg_metadata() -> tuple[dict[str, list[str]], dict[tuple[str, str], str]]:
    raw = psql(
        "SELECT table_name || chr(9) || column_name || chr(9) || data_type "
        "FROM information_schema.columns WHERE table_schema='public' "
        "ORDER BY table_name, ordinal_position"
    )
    columns: dict[str, list[str]] = {}
    types: dict[tuple[str, str], str] = {}
    for line in raw.splitlines():
        table, column, data_type = line.split("\t", 2)
        columns.setdefault(table, []).append(column)
        types[(table, column)] = data_type
    return columns, types


def sql_ident(value: str) -> str:
    return '"' + value.replace('"', '""') + '"'


def csv_value(value, data_type: str) -> str:
    if value is None:
        return r"\N"
    if data_type == "boolean":
        value = "true" if bool(value) else "false"
    elif isinstance(value, bytes):
        value = "\\x" + value.hex()
    else:
        value = str(value)
    return '"' + value.replace('"', '""') + '"'


def copy_statement(table: str, stage: str, columns: list[str], rows, types) -> str:
    names = ", ".join(sql_ident(c) for c in columns)
    statement = (
        f"CREATE TEMP TABLE {sql_ident(stage)} (LIKE public.{sql_ident(table)} EXCLUDING ALL) ON COMMIT DROP;\n"
        f"COPY {sql_ident(stage)} ({names}) FROM STDIN WITH (FORMAT CSV, NULL '\\N');\n"
    )
    for row in rows:
        statement += ",".join(csv_value(row[c], types[(table, c)]) for c in columns) + "\n"
    return statement + "\\.\n"


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, default=DEFAULT_SOURCE)
    parser.add_argument("--apply", action="store_true", help="commit the migration (otherwise rollback dry-run)")
    parser.add_argument("--backup-dir", type=Path, help="directory containing sqlite-source.db and postgres-target-before.dump")
    args = parser.parse_args()
    source = args.source.resolve()
    if not source.is_file():
        parser.error(f"SQLite source not found: {source}")
    if args.apply:
        if not args.backup_dir:
            parser.error("--apply requires --backup-dir with verified backups")
        backup_dir = args.backup_dir.resolve()
        sqlite_backup = backup_dir / "sqlite-source.db"
        pg_backup = backup_dir / "postgres-target-before.dump"
        if not sqlite_backup.is_file() or not pg_backup.is_file():
            parser.error("both sqlite-source.db and postgres-target-before.dump must exist in --backup-dir")
        if hashlib.sha256(source.read_bytes()).digest() != hashlib.sha256(sqlite_backup.read_bytes()).digest():
            parser.error("SQLite backup does not match the source database")
        subprocess.run(["pg_restore", "--list", str(pg_backup)], stdout=subprocess.DEVNULL, check=True)

    db = sqlite3.connect(f"file:{source}?mode=ro", uri=True)
    db.row_factory = sqlite3.Row
    try:
        integrity = db.execute("PRAGMA integrity_check").fetchone()[0]
        violations = db.execute("PRAGMA foreign_key_check").fetchall()
        if integrity != "ok" or violations:
            raise SystemExit(f"Source integrity failed: integrity={integrity}, fk_violations={len(violations)}")

        seed_source = (ROOT / "prisma/seed.ts").read_text()
        seed_emails = {
            hashlib.sha256(email.strip().lower().encode()).hexdigest()
            for email in re.findall(r"email\s*:\s*['\"]([^'\"]+)", seed_source)
        }
        pg_columns, pg_types = pg_metadata()
        source_tables = {
            row[0] for row in db.execute(
                "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
            )
        }
        counts = {
            table: db.execute(f"SELECT count(*) FROM {sql_ident(table)}").fetchone()[0]
            for table in source_tables
        }
        unknown = [t for t, n in counts.items() if n and t not in pg_columns and t not in SKIP_TABLES]
        if unknown:
            raise SystemExit(f"Non-empty SQLite tables have no PostgreSQL target: {sorted(unknown)}")
        unordered = [t for t, n in counts.items() if n and t not in TABLE_ORDER and t not in SKIP_TABLES]
        if unordered:
            raise SystemExit(f"Add these populated tables to TABLE_ORDER before migration: {sorted(unordered)}")

        data: dict[str, tuple[list[str], list[dict], list[str]]] = {}
        disabled_demo_accounts = 0
        for table in TABLE_ORDER:
            if not counts.get(table):
                continue
            source_columns = [r[1] for r in db.execute(f"PRAGMA table_info({sql_ident(table)})")]
            target_columns = pg_columns[table]
            if set(source_columns) != set(target_columns):
                raise SystemExit(
                    f"Schema mismatch in {table}; explicit field mapping required. "
                    f"SQLite-only={sorted(set(source_columns)-set(target_columns))}, "
                    f"PostgreSQL-only={sorted(set(target_columns)-set(source_columns))}"
                )
            rows = [dict(r) for r in db.execute(f"SELECT * FROM {sql_ident(table)}")]
            if table == "User":
                for row in rows:
                    key = hashlib.sha256((row.get("email") or "").strip().lower().encode()).hexdigest()
                    if key in seed_emails:
                        # Preserve the profile, but do not activate repository demo credentials.
                        row["active"] = 0
                        row["passwordHash"] = None
                        disabled_demo_accounts += 1
            # Source order follows the live PostgreSQL schema for predictable COPY input.
            columns = target_columns
            data[table] = (columns, rows, source_columns)

        settings = data.get("SchoolSettings")
        if settings and len(settings[1]) != 1:
            raise SystemExit("Expected exactly one SQLite SchoolSettings row for singleton merge")
        if settings and int(psql('SELECT count(*) FROM public."SchoolSettings"')) != 1:
            raise SystemExit("Expected exactly one configured PostgreSQL SchoolSettings row; refusing ambiguous merge")

        print("SQLite integrity: ok; foreign-key violations: 0")
        print("Data rows to import:")
        for table, (_, rows, _) in data.items():
            print(f"  {table}: {len(rows)}")
        print(f"SchoolSettings: merge into existing row (source secrets left unchanged when empty)")
        print(f"Skipped operational records: Session={counts.get('Session', 0)}, LoginAttempt={counts.get('LoginAttempt', 0)}, Prisma migrations excluded")
        print(f"Known demo accounts to disable and clear password hash: {disabled_demo_accounts}")

        sql = ["BEGIN;", "SET LOCAL lock_timeout = '5s';", "SET LOCAL statement_timeout = '60s';"]
        for table in TABLE_ORDER:
            if table not in data or table == "SchoolSettings":
                continue
            columns, rows, _ = data[table]
            stage = f"qschool_migration_{table}"
            sql.append(copy_statement(table, stage, columns, rows, pg_types))
            cols = ", ".join(sql_ident(c) for c in columns)
            sql.append(
                f"INSERT INTO public.{sql_ident(table)} ({cols}) "
                f"SELECT {cols} FROM {sql_ident(stage)};\n"
            )

        if settings:
            settings_cols, settings_rows, _ = settings
            stage = "qschool_migration_SchoolSettings"
            sql.append(copy_statement("SchoolSettings", stage, settings_cols, settings_rows, pg_types))
            assign = []
            for col in settings_cols:
                if col in SETTING_INTERNAL:
                    continue
                q = sql_ident(col)
                if col in SECRET_SETTINGS or pg_types[("SchoolSettings", col)] in {"text", "character varying"}:
                    expr = f"COALESCE(NULLIF(s.{q}, ''), t.{q})"
                else:
                    expr = f"COALESCE(s.{q}, t.{q})"
                assign.append(f"{q} = {expr}")
            assign.append('"updatedAt" = CURRENT_TIMESTAMP')
            sql.append(
                f"UPDATE public.\"SchoolSettings\" AS t SET {', '.join(assign)} "
                f"FROM {sql_ident(stage)} AS s;\n"
            )

        sql.append("ROLLBACK;" if not args.apply else "COMMIT;")
        result = subprocess.run(
            ["docker", "compose", "exec", "-T", "db", "psql", "-X", "-v", "ON_ERROR_STOP=1", "-U", "tpt", "-d", "tpt_school"],
            cwd=ROOT, input="\n".join(sql), text=True, capture_output=True,
        )
        if result.returncode:
            raise SystemExit("PostgreSQL transaction failed; it was rolled back. Review migration diagnostics without exposing row data.")
        if not args.apply:
            print("Dry-run passed; all changes were rolled back.")
        else:
            print("Migration committed. Run the post-import count and relationship checks before reopening user access.")
        return 0
    finally:
        db.close()


if __name__ == "__main__":
    raise SystemExit(main())

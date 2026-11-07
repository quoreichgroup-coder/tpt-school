# Legacy SQLite inventory and migration report

`dev.db` was inspected read-only on 2026-11-05 before migration. Integrity check was `ok`; it contained 45 application tables and zero foreign-key violations. Non-empty records were: User (7), Student (3), Staff (3), AcademicYear (2), Term (8), Room (8), Class (3), ClassTeacher (3), ClassEnrolment (5), SchoolSettings (1), Session (1), and LoginAttempt (2).

## Import completed

At the user's request, the application data was imported into the running PostgreSQL database on 2026-11-05 using `scripts/migrate-sqlite-to-postgres.py`. A full dry-run completed and rolled back before the import transaction committed.

Post-import counts include User (8, including the pre-existing PostgreSQL admin), Student (3), Staff (3), AcademicYear (2), Term (8), Room (8), Class (3), ClassTeacher (3), ClassEnrolment (5), and SchoolSettings (1). The existing PostgreSQL admin, settings row, session, and login-attempt record were preserved. The SQLite school settings were merged into the existing settings row; empty source credential fields do not erase target secrets. `setupComplete` is now true.

Six student/teacher accounts matched the repository's known demo seed accounts. Their student/staff profiles and class relationships were imported, while their user accounts were disabled and their password hashes cleared. The imported non-seed admin account remains active. SQLite sessions, login attempts, verification tokens, and `_prisma_migrations` were not copied.

The source `dev.db` remains unchanged. Before import, mode-600 backups were saved outside the repository at:

`/home/abdouramane/backups/qschool-sqlite-migration-20261105T175643Z/`

This directory contains `sqlite-source.db` and `postgres-target-before.dump`. Both were verified before the transaction. PostgreSQL foreign keys accepted all imported rows; a post-import query found zero invalid class enrolments, and `/api/health` returned `status: ok`, `database: ok`.

## Tooling for a separate migration

```bash
# Only for a new source/target pair; this source is already imported here.
# Read-only dry-run; all database changes are rolled back.
python3 scripts/migrate-sqlite-to-postgres.py --source dev.db

# For a fresh target, first make the required backups, then apply:
python3 scripts/migrate-sqlite-to-postgres.py --source /path/to/source.db --apply \
  --backup-dir /path/to/fresh-backup-directory
```

Do not apply this import a second time to the current database; unique-key conflicts make a repeat fail and roll back. To reverse this migration, restore the pre-import PostgreSQL dump during a maintenance window. Keep the original SQLite file and backup until school users confirm the imported records.

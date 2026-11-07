#!/usr/bin/env python3
"""Report SQLite schema and row counts without writing or showing record data."""
import argparse
import sqlite3
from pathlib import Path

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("database", type=Path, help="SQLite database file to inspect")
args = parser.parse_args()

connection = sqlite3.connect(f"file:{args.database.resolve()}?mode=ro", uri=True)
try:
    integrity = connection.execute("PRAGMA integrity_check").fetchone()[0]
    tables = [row[0] for row in connection.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
    )]
    print(f"Integrity: {integrity}")
    print(f"Application tables: {len(tables)}")
    for table in tables:
        quoted = '"' + table.replace('"', '""') + '"'
        count = connection.execute(f"SELECT count(*) FROM {quoted}").fetchone()[0]
        if count:
            print(f"{table}: {count}")
    violations = connection.execute("PRAGMA foreign_key_check").fetchall()
    print(f"Foreign-key violations: {len(violations)}")
finally:
    connection.close()

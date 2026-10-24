"""
Safe additive migration (Issue 7).

Adds the verification audit columns to `creator_profiles`:

    verified_at  DATETIME  NULL
    verified_by  INTEGER   NULL   -> users.id

Additive only. It adds nullable columns, never drops or rewrites a column, never
touches row data, and never resets the database. Idempotent: existing columns
are detected and skipped, so re-running is a no-op.

    python migrate_add_verification_audit.py
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.chdir(os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy import inspect, text

from app.core.database import engine

TABLE = "creator_profiles"

NEW_COLUMNS = {
    "verified_at": "DATETIME",
    "verified_by": "INTEGER",
}

def main():
    inspector = inspect(engine)

    if TABLE not in inspector.get_table_names():
        print(f"Table '{TABLE}' does not exist yet - nothing to migrate.")
        print("It will be created with these columns on next app startup.")
        return

    existing = {c["name"] for c in inspector.get_columns(TABLE)}
    print(f"Table '{TABLE}' currently has {len(existing)} columns.")

    added = []
    skipped = []
    with engine.begin() as conn:
        for name, sql_type in NEW_COLUMNS.items():
            if name in existing:
                skipped.append(name)
                continue
            conn.execute(text(f"ALTER TABLE {TABLE} ADD COLUMN {name} {sql_type}"))
            added.append(name)

    for name in skipped:
        print(f"  skip  {name} - already present")
    for name in added:
        print(f"  added {name}")

    after = {c["name"] for c in inspect(engine).get_columns(TABLE)}
    with engine.connect() as conn:
        rows = conn.execute(text(f"SELECT COUNT(*) FROM {TABLE}")).scalar()

    missing = set(NEW_COLUMNS) - after
    if missing:
        print(f"\nFAILED - still missing: {sorted(missing)}")
        sys.exit(1)

    print(f"\nOK. '{TABLE}' now has {len(after)} columns, {rows} rows preserved.")
    if not added:
        print("No changes were needed.")

if __name__ == "__main__":
    main()

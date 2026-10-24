"""Non-destructive database connectivity check.

Runs `SELECT 1` against the configured database and reports success or failure.
It never prints the connection URL, username, or password — only a safe
dialect/host descriptor. Intended to be run AFTER the owner has configured the
rotated MySQL credentials + CA certificate in the backend environment:

    cd backend
    PYTHONPATH=. python check_db_connection.py

Exit code 0 = reachable, 1 = failed. This performs no writes, no schema
creation, and no migration — connectivity only.
"""
import sys

from sqlalchemy import text

from app.core.database import engine, safe_db_descriptor


def main() -> int:
    print(f"Target: {safe_db_descriptor()}  (dialect: {engine.dialect.name})")
    try:
        with engine.connect() as conn:
            result = conn.execute(text("SELECT 1")).scalar()
        if result == 1:
            print("Connectivity: SUCCESS (SELECT 1 returned 1)")
            return 0
        print(f"Connectivity: UNEXPECTED result from SELECT 1: {result!r}")
        return 1
    except Exception as exc:  # noqa: BLE001 - report any driver/TLS/auth failure
        # Driver exceptions carry server-side detail (host/user, TLS errors) but
        # not the password, since the password is never stringified into the URL.
        print(f"Connectivity: FAILED ({type(exc).__name__}): {exc}")
        return 1


if __name__ == "__main__":
    sys.exit(main())

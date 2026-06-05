"""
One-shot migration runner. Run from repo root:
  .venv/Scripts/python scripts/run_migrations.py
Reads DATABASE_URL from environment or backend/.env.
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

# Load backend/.env if DATABASE_URL not already set
if "DATABASE_URL" not in os.environ:
    env_file = Path(__file__).parent.parent / "backend" / ".env"
    if env_file.exists():
        for line in env_file.read_text().splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, _, v = line.partition("=")
                os.environ.setdefault(k.strip(), v.strip())

import psycopg2

MIGRATIONS_DIR = Path(__file__).parent.parent / "backend" / "db" / "migrations"
ORDER = [
    "001_schema.sql",
    "002_disable_rls.sql",
    "003_refactor_questions.sql",
    "004_session_skills.sql",
    "005_rag_tables.sql",
    "006_session_pathways.sql",
    "007_match_rag_chunks_fn.sql",
]

def main() -> None:
    db_url = os.environ.get("DATABASE_URL")
    if not db_url:
        sys.exit("DATABASE_URL not set and backend/.env not found")

    print(f"Connecting to {db_url.split('@')[1] if '@' in db_url else db_url}")
    conn = psycopg2.connect(db_url)
    conn.autocommit = True
    cur = conn.cursor()

    for name in ORDER:
        path = MIGRATIONS_DIR / name
        if not path.exists():
            sys.exit(f"Migration file not found: {path}")
        sql = path.read_text(encoding="utf-8")
        print(f"  Running {name}...", end=" ", flush=True)
        try:
            cur.execute(sql)
            print("OK")
        except Exception as exc:
            print(f"FAILED\n  Error: {exc}")
            sys.exit(1)

    cur.close()
    conn.close()
    print("\nAll migrations applied successfully.")

if __name__ == "__main__":
    main()

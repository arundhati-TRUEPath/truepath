from __future__ import annotations

import os

import psycopg2
import psycopg2.extras
from pgvector.psycopg2 import register_vector

from embeddings.embed import embed_text

_DEFAULT_TOP_K = 5
_DEFAULT_THRESHOLD = 0.5

_DATABASE_URL = os.environ["DATABASE_URL"]


def _connect():
    conn = psycopg2.connect(_DATABASE_URL)
    conn.autocommit = True
    register_vector(conn)
    return conn


def retrieve(query: str, top_k: int = _DEFAULT_TOP_K, threshold: float = _DEFAULT_THRESHOLD) -> list[dict]:
    query_embedding = embed_text(query)
    conn = _connect()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                "SELECT * FROM match_rag_chunks(%s::vector, %s, %s)",
                [query_embedding, threshold, top_k],
            )
            return [dict(row) for row in cur.fetchall()]
    finally:
        conn.close()

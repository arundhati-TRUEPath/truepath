from __future__ import annotations

import os

from supabase import create_client, Client

from embeddings.embed import embed_text

_DEFAULT_TOP_K = 5
_DEFAULT_THRESHOLD = 0.5


def _db() -> Client:
    return create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_KEY"])


def retrieve(query: str, top_k: int = _DEFAULT_TOP_K, threshold: float = _DEFAULT_THRESHOLD) -> list[dict]:
    query_embedding = embed_text(query)
    result = _db().rpc(
        "match_rag_chunks",
        {
            "query_embedding": query_embedding,
            "match_threshold": threshold,
            "match_count": top_k,
        },
    ).execute()
    return result.data or []

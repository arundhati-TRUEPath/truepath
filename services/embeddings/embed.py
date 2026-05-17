from __future__ import annotations

import os

from openai import OpenAI

_client: OpenAI | None = None


def _get_client() -> OpenAI:
    global _client
    if _client is None:
        _client = OpenAI(api_key=os.environ["OPENAI_API_KEY"])
    return _client


def _model() -> str:
    return os.environ.get("OPENAI_EMBEDDING_MODEL", "text-embedding-3-small")


def embed_text(text: str) -> list[float]:
    response = _get_client().embeddings.create(input=text, model=_model())
    return response.data[0].embedding


def embed_batch(texts: list[str]) -> list[list[float]]:
    if not texts:
        return []
    response = _get_client().embeddings.create(input=texts, model=_model())
    ordered = sorted(response.data, key=lambda x: x.index)
    return [item.embedding for item in ordered]

from __future__ import annotations


def embed_text(text: str) -> list[float]:
    raise NotImplementedError


def embed_batch(texts: list[str]) -> list[list[float]]:
    raise NotImplementedError

from __future__ import annotations

from pathlib import Path


def retrieve(query_embedding: list[float], index_path: Path, top_k: int = 5) -> list[dict]:
    raise NotImplementedError

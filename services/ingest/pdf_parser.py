from __future__ import annotations

import re
from pathlib import Path

import pdfplumber


def _clean(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()


def extract_chunks(pdf_path: Path, chunk_words: int = 400, overlap_words: int = 50) -> list[dict]:
    pages: list[tuple[int, str]] = []
    with pdfplumber.open(pdf_path) as pdf:
        for page_num, page in enumerate(pdf.pages, start=1):
            text = _clean(page.extract_text() or "")
            if text:
                pages.append((page_num, text))

    if not pages:
        return []

    # Build a flat word list that tracks which page each word came from
    word_pages: list[tuple[str, int]] = []
    for page_num, text in pages:
        for word in text.split():
            word_pages.append((word, page_num))

    chunks: list[dict] = []
    chunk_index = 0
    i = 0
    while i < len(word_pages):
        window = word_pages[i : i + chunk_words]
        content = " ".join(w for w, _ in window).strip()
        if content:
            page_set = sorted({p for _, p in window})
            chunks.append(
                {
                    "chunk_index": chunk_index,
                    "content": content,
                    "metadata": {
                        "source": pdf_path.name,
                        "pages": page_set,
                    },
                }
            )
            chunk_index += 1
        i += chunk_words - overlap_words

    return chunks

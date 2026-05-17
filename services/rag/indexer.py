from __future__ import annotations

import logging
import os
from pathlib import Path

from supabase import create_client, Client

from embeddings.embed import embed_batch
from ingest.excel_parser import extract_chunks as excel_chunks
from ingest.pdf_parser import extract_chunks as pdf_chunks

_RAG_DATA_DIR = Path(__file__).parent.parent.parent / "rag-data"
_EMBED_BATCH_SIZE = 20

logger = logging.getLogger(__name__)


def _db() -> Client:
    return create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_KEY"])


def _upsert_document(db: Client, file_name: str, file_type: str, source_path: str) -> str:
    result = (
        db.table("rag_documents")
        .upsert(
            {"file_name": file_name, "file_type": file_type, "source_path": source_path},
            on_conflict="file_name",
        )
        .execute()
    )
    return result.data[0]["id"]


def _upsert_chunks(
    db: Client, document_id: str, chunks: list[dict], embeddings: list[list[float]]
) -> None:
    rows = [
        {
            "document_id": document_id,
            "chunk_index": chunk["chunk_index"],
            "content": chunk["content"],
            "embedding": embedding,
            "metadata": chunk["metadata"],
        }
        for chunk, embedding in zip(chunks, embeddings)
    ]
    db.table("rag_chunks").upsert(rows, on_conflict="document_id,chunk_index").execute()


def build_index(rag_data_dir: Path | None = None) -> dict:
    data_dir = rag_data_dir or _RAG_DATA_DIR
    db = _db()
    processed: list[dict] = []
    errors: list[dict] = []

    for file_path in sorted(data_dir.iterdir()):
        suffix = file_path.suffix.lower()
        if suffix == ".pdf":
            file_type = "pdf"
            chunks = pdf_chunks(file_path)
        elif suffix in {".xlsx", ".xls"}:
            file_type = "excel"
            chunks = excel_chunks(file_path)
        else:
            continue

        if not chunks:
            errors.append({"file": file_path.name, "reason": "no_chunks_extracted"})
            continue

        try:
            doc_id = _upsert_document(db, file_path.name, file_type, str(file_path))

            texts = [c["content"] for c in chunks]
            all_embeddings: list[list[float]] = []
            for i in range(0, len(texts), _EMBED_BATCH_SIZE):
                all_embeddings.extend(embed_batch(texts[i : i + _EMBED_BATCH_SIZE]))

            _upsert_chunks(db, doc_id, chunks, all_embeddings)
            db.table("rag_documents").update({"chunk_count": len(chunks)}).eq("id", doc_id).execute()

            logger.info("ingested %s (%d chunks)", file_path.name, len(chunks))
            processed.append({"file": file_path.name, "chunks": len(chunks)})
        except Exception as exc:
            logger.error("failed to ingest %s: %s", file_path.name, exc)
            errors.append({"file": file_path.name, "reason": str(exc)})

    return {"processed": processed, "errors": errors}

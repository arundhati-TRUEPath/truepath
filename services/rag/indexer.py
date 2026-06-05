from __future__ import annotations

import logging
import os
import shutil
import tempfile
from pathlib import Path

import psycopg2
import psycopg2.extras
from pgvector.psycopg2 import register_vector

from embeddings.embed import embed_batch
from ingest.excel_parser import extract_chunks as excel_chunks
from ingest.pdf_parser import extract_chunks as pdf_chunks

_RAG_DATA_DIR = Path(__file__).parent.parent.parent / "rag-data"
_EMBED_BATCH_SIZE = 20

logger = logging.getLogger(__name__)


def _connect():
    conn = psycopg2.connect(os.environ["DATABASE_URL"])
    conn.autocommit = True
    register_vector(conn)
    return conn


def _download_from_blob() -> Path:
    from azure.identity import DefaultAzureCredential
    from azure.storage.blob import BlobServiceClient

    account_name = os.environ["AZURE_STORAGE_ACCOUNT_NAME"]
    container_name = os.environ.get("AZURE_STORAGE_CONTAINER", "rag-data")
    account_url = f"https://{account_name}.blob.core.windows.net"

    client_id = os.environ.get("AZURE_CLIENT_ID")
    credential = DefaultAzureCredential(managed_identity_client_id=client_id)
    service = BlobServiceClient(account_url=account_url, credential=credential)
    container = service.get_container_client(container_name)

    tmp_dir = Path(tempfile.mkdtemp())
    for blob in container.list_blobs():
        dest = tmp_dir / blob.name
        dest.parent.mkdir(parents=True, exist_ok=True)
        with open(dest, "wb") as fh:
            fh.write(container.get_blob_client(blob.name).download_blob().readall())
        logger.info("downloaded blob %s", blob.name)

    return tmp_dir


def _upsert_document(cur, file_name: str, file_type: str, source_path: str) -> str:
    cur.execute(
        """
        INSERT INTO rag_documents (file_name, file_type, source_path)
        VALUES (%s, %s, %s)
        ON CONFLICT (file_name) DO UPDATE
          SET file_type   = EXCLUDED.file_type,
              source_path = EXCLUDED.source_path,
              updated_at  = now()
        RETURNING id
        """,
        (file_name, file_type, source_path),
    )
    return cur.fetchone()[0]


def _upsert_chunks(
    cur, document_id: str, chunks: list[dict], embeddings: list[list[float]]
) -> None:
    rows = [
        (
            document_id,
            chunk["chunk_index"],
            chunk["content"],
            embedding,
            psycopg2.extras.Json(chunk["metadata"]),
        )
        for chunk, embedding in zip(chunks, embeddings)
    ]
    psycopg2.extras.execute_values(
        cur,
        """
        INSERT INTO rag_chunks (document_id, chunk_index, content, embedding, metadata)
        VALUES %s
        ON CONFLICT (document_id, chunk_index) DO UPDATE
          SET content   = EXCLUDED.content,
              embedding = EXCLUDED.embedding,
              metadata  = EXCLUDED.metadata
        """,
        rows,
    )


def build_index(rag_data_dir: Path | None = None) -> dict:
    storage_mode = os.getenv("STORAGE_MODE", "local")
    tmp_dir: Path | None = None

    if rag_data_dir is not None:
        data_dir = rag_data_dir
    elif storage_mode == "azure":
        tmp_dir = _download_from_blob()
        data_dir = tmp_dir
    else:
        data_dir = _RAG_DATA_DIR

    conn = _connect()
    cur = conn.cursor()
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
            doc_id = _upsert_document(cur, file_path.name, file_type, str(file_path))

            texts = [c["content"] for c in chunks]
            all_embeddings: list[list[float]] = []
            for i in range(0, len(texts), _EMBED_BATCH_SIZE):
                all_embeddings.extend(embed_batch(texts[i : i + _EMBED_BATCH_SIZE]))

            _upsert_chunks(cur, doc_id, chunks, all_embeddings)
            cur.execute(
                "UPDATE rag_documents SET chunk_count = %s WHERE id = %s",
                (len(chunks), doc_id),
            )

            logger.info("ingested %s (%d chunks)", file_path.name, len(chunks))
            processed.append({"file": file_path.name, "chunks": len(chunks)})
        except Exception as exc:
            logger.error("failed to ingest %s: %s", file_path.name, exc)
            errors.append({"file": file_path.name, "reason": str(exc)})

    cur.close()
    conn.close()

    if tmp_dir is not None:
        shutil.rmtree(tmp_dir, ignore_errors=True)

    return {"processed": processed, "errors": errors}

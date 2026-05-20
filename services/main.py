from __future__ import annotations

from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

import json
import logging
import time
import uuid

from fastapi import FastAPI, HTTPException, Request
from pydantic import BaseModel, Field
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response

from embeddings.embed import embed_batch, embed_text
from rag.indexer import build_index
from rag.retriever import retrieve

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
log = logging.getLogger("truepath.services")

app = FastAPI(title="TruePath Python Services", version="1.0.0")

_MAX_BODY_CHARS = 4_000


def _truncate(text: str) -> str:
    if len(text) <= _MAX_BODY_CHARS:
        return text
    return f"{text[:_MAX_BODY_CHARS]}... [truncated, total {len(text)} chars]"


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        request_id = uuid.uuid4().hex[:8]
        start = time.perf_counter()

        body_bytes = await request.body()
        try:
            body_repr = json.dumps(json.loads(body_bytes)) if body_bytes else ""
        except Exception:
            body_repr = body_bytes.decode("utf-8", errors="replace")

        log.info(
            "[%s] -> %s %s body=%s",
            request_id, request.method, request.url.path, _truncate(body_repr) or "(empty)",
        )

        response = await call_next(request)
        duration_ms = (time.perf_counter() - start) * 1000

        chunks: list[bytes] = []
        async for chunk in response.body_iterator:
            chunks.append(chunk)
        raw = b"".join(chunks)

        try:
            preview = _truncate(raw.decode("utf-8"))
        except UnicodeDecodeError:
            preview = f"[binary, {len(raw)} bytes]"

        log.info(
            "[%s] <- %d %s %s (%.1f ms) body=%s",
            request_id, response.status_code, request.method, request.url.path, duration_ms, preview,
        )

        return Response(
            content=raw,
            status_code=response.status_code,
            headers=dict(response.headers),
            media_type=response.media_type,
        )


app.add_middleware(RequestLoggingMiddleware)


class EmbedRequest(BaseModel):
    text: str


class EmbedBatchRequest(BaseModel):
    texts: list[str]


class SearchRequest(BaseModel):
    query: str
    top_k: int = Field(default=5, ge=1, le=50)
    threshold: float = Field(default=0.5, ge=0.0, le=1.0)


class IngestRequest(BaseModel):
    rag_data_dir: str | None = None


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


@app.post("/embed")
def embed_single(req: EmbedRequest) -> dict:
    try:
        embedding = embed_text(req.text)
        return {"embedding": embedding, "dimensions": len(embedding)}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.post("/embed-batch")
def embed_batch_endpoint(req: EmbedBatchRequest) -> dict:
    try:
        embeddings = embed_batch(req.texts)
        return {"embeddings": embeddings, "count": len(embeddings)}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.post("/ingest")
def ingest(req: IngestRequest = IngestRequest()) -> dict:
    try:
        data_dir = Path(req.rag_data_dir) if req.rag_data_dir else None
        return build_index(data_dir)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.post("/search")
def search(req: SearchRequest) -> dict:
    try:
        results = retrieve(req.query, req.top_k, req.threshold)
        return {"results": results, "count": len(results)}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

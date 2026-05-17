from __future__ import annotations

from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

import logging

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from embeddings.embed import embed_batch, embed_text
from rag.indexer import build_index
from rag.retriever import retrieve

logging.basicConfig(level=logging.INFO)

app = FastAPI(title="TruePath Python Services", version="1.0.0")


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

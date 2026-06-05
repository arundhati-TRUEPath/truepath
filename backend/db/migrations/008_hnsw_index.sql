-- Migration 008: HNSW index for fast approximate nearest-neighbour vector search
-- Run this AFTER rag_chunks is populated (HNSW builds faster on a populated table).
CREATE INDEX IF NOT EXISTS idx_rag_chunks_embedding_hnsw
  ON rag_chunks USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

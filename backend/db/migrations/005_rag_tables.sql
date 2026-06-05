-- Migration 005: RAG document store and vector chunks
-- Migration 005: RAG document store.
-- Originally applied only in Supabase; reconstructed and committed during Azure migration.
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS rag_documents (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  file_name    TEXT        NOT NULL UNIQUE,
  file_type    TEXT        NOT NULL CHECK (file_type IN ('pdf', 'excel')),
  source_path  TEXT        NOT NULL,
  chunk_count  INTEGER     NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS rag_chunks (
  id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id  UUID         NOT NULL REFERENCES rag_documents(id) ON DELETE CASCADE,
  chunk_index  INTEGER      NOT NULL,
  content      TEXT         NOT NULL,
  embedding    vector(1536) NOT NULL,
  metadata     JSONB        NOT NULL DEFAULT '{}',
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
  UNIQUE (document_id, chunk_index)
);

CREATE INDEX IF NOT EXISTS idx_rag_chunks_document_id ON rag_chunks(document_id);
ALTER TABLE rag_documents DISABLE ROW LEVEL SECURITY;
ALTER TABLE rag_chunks    DISABLE ROW LEVEL SECURITY;

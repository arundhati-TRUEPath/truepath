-- Migration 007: pgvector cosine similarity search function
-- Replaces the match_rag_chunks RPC that Supabase auto-generated from the pgvector integration.
CREATE OR REPLACE FUNCTION match_rag_chunks(
  query_embedding vector(1536),
  match_threshold float,
  match_count     int
)
RETURNS TABLE (
  id          uuid,
  document_id uuid,
  chunk_index integer,
  content     text,
  metadata    jsonb,
  file_name   text,
  similarity  float
)
LANGUAGE sql STABLE
AS $$
  SELECT
    rc.id,
    rc.document_id,
    rc.chunk_index,
    rc.content,
    rc.metadata,
    rd.file_name,
    1 - (rc.embedding <=> query_embedding) AS similarity
  FROM rag_chunks rc
  JOIN rag_documents rd ON rd.id = rc.document_id
  WHERE 1 - (rc.embedding <=> query_embedding) > match_threshold
  ORDER BY rc.embedding <=> query_embedding
  LIMIT match_count;
$$;

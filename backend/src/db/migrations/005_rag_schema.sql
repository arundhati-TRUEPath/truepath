-- Enable pgvector
create extension if not exists vector;

-- One record per ingested source file
create table if not exists rag_documents (
  id          uuid      primary key default gen_random_uuid(),
  file_name   text      not null unique,
  file_type   text      not null check (file_type in ('pdf', 'excel')),
  source_path text      not null,
  chunk_count integer   not null default 0,
  ingested_at timestamptz not null default now()
);

-- One record per text chunk extracted from a source file
create table if not exists rag_chunks (
  id          uuid      primary key default gen_random_uuid(),
  document_id uuid      not null references rag_documents(id) on delete cascade,
  chunk_index integer   not null,
  content     text      not null,
  embedding   vector(1536),
  metadata    jsonb     not null default '{}',
  created_at  timestamptz not null default now(),
  unique (document_id, chunk_index)
);

-- HNSW index for fast approximate cosine similarity search
create index if not exists rag_chunks_embedding_idx
  on rag_chunks using hnsw (embedding vector_cosine_ops);

-- Similarity search function called via supabase.rpc('match_rag_chunks', ...)
create or replace function match_rag_chunks(
  query_embedding vector(1536),
  match_threshold float default 0.5,
  match_count     int   default 5
)
returns table (
  id          uuid,
  document_id uuid,
  chunk_index int,
  content     text,
  metadata    jsonb,
  file_name   text,
  similarity  float
)
language sql stable
as $$
  select
    rc.id,
    rc.document_id,
    rc.chunk_index,
    rc.content,
    rc.metadata,
    rd.file_name,
    1 - (rc.embedding <=> query_embedding) as similarity
  from rag_chunks rc
  join rag_documents rd on rd.id = rc.document_id
  where rc.embedding is not null
    and 1 - (rc.embedding <=> query_embedding) > match_threshold
  order by rc.embedding <=> query_embedding
  limit match_count;
$$;

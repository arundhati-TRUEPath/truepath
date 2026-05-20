-- Migration 006: session_pathways table and pathways_complete session status
-- Stores the generated 3-pathway recommendation as a snapshot per session so
-- the page is idempotent on reload and the PDF export reads the same source.

ALTER TABLE sessions DROP CONSTRAINT IF EXISTS sessions_status_check;
ALTER TABLE sessions ADD CONSTRAINT sessions_status_check
  CHECK (status IN ('in_progress', 'seed_complete', 'followup_complete', 'skills_complete', 'pathways_complete'));

CREATE TABLE IF NOT EXISTS session_pathways (
  session_id    UUID        PRIMARY KEY REFERENCES sessions(id) ON DELETE CASCADE,
  pathways      JSONB       NOT NULL,
  limitations   JSONB       NOT NULL,
  source_files  TEXT[]      NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_session_pathways_session_id ON session_pathways(session_id);

ALTER TABLE session_pathways DISABLE ROW LEVEL SECURITY;

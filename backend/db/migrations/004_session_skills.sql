-- Migration 004: session_skills table and skills_complete session status

ALTER TABLE sessions DROP CONSTRAINT IF EXISTS sessions_status_check;
ALTER TABLE sessions ADD CONSTRAINT sessions_status_check
  CHECK (status IN ('in_progress', 'seed_complete', 'followup_complete', 'skills_complete'));

CREATE TABLE IF NOT EXISTS session_skills (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id   UUID        NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  skill_id     TEXT        NOT NULL,
  label        TEXT        NOT NULL,
  sub          TEXT        NOT NULL,
  confidence   TEXT        NOT NULL CHECK (confidence IN ('high', 'medium')),
  rationale    TEXT        NOT NULL,
  confirmed    BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (session_id, skill_id)
);

CREATE INDEX IF NOT EXISTS idx_session_skills_session_id ON session_skills(session_id);

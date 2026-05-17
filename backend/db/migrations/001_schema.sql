-- Migration 001: core schema for sessions, questions, choices, and responses

CREATE TABLE IF NOT EXISTS sessions (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at  TIMESTAMPTZ NOT NULL    DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL    DEFAULT now(),
  status      TEXT        NOT NULL    DEFAULT 'in_progress'
              CHECK (status IN ('in_progress', 'seed_complete', 'followup_complete'))
);

CREATE TABLE IF NOT EXISTS questions (
  id              TEXT        PRIMARY KEY,
  title           TEXT        NOT NULL,
  hint            TEXT,
  is_multi        BOOLEAN     NOT NULL DEFAULT FALSE,
  layout          TEXT        NOT NULL DEFAULT 'wrap'
                  CHECK (layout IN ('wrap', 'column')),
  display_order   INTEGER     NOT NULL,
  question_type   TEXT        NOT NULL DEFAULT 'seed'
                  CHECK (question_type IN ('seed', 'followup_template'))
);

CREATE TABLE IF NOT EXISTS question_choices (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id     TEXT        NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  option_key      TEXT        NOT NULL,
  label           TEXT        NOT NULL,
  display_order   INTEGER     NOT NULL,
  UNIQUE (question_id, option_key)
);

CREATE TABLE IF NOT EXISTS session_responses (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id            UUID        NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  question_id           TEXT        NOT NULL,
  selected_option_keys  TEXT[]      NOT NULL,
  question_type         TEXT        NOT NULL DEFAULT 'seed'
                        CHECK (question_type IN ('seed', 'followup')),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_session_responses_session_id ON session_responses(session_id);
CREATE INDEX IF NOT EXISTS idx_question_choices_question_id ON question_choices(question_id);

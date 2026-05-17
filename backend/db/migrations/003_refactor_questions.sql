-- Migration 003: Refactor questions schema
-- Drops and recreates questions, question_choices, session_responses with new structure.
-- Execute this in the Supabase SQL editor. Existing data will be cleared.

-- 1. Drop tables in dependency order
DROP TABLE IF EXISTS session_responses;
DROP TABLE IF EXISTS question_choices;
DROP TABLE IF EXISTS questions;

-- 2. Recreate questions
CREATE TABLE questions (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  title             TEXT        NOT NULL,
  hint              TEXT        NOT NULL,
  is_multi          BOOLEAN     NOT NULL DEFAULT FALSE,
  layout            TEXT        NOT NULL DEFAULT 'wrap'
                    CHECK (layout IN ('wrap', 'column')),
  display_order     INTEGER     NOT NULL,
  source            TEXT        NOT NULL DEFAULT 'seed'
                    CHECK (source IN ('seed', 'ai')),
  ai_id             TEXT,
  question_category TEXT        NOT NULL
);

-- 3. Recreate question_choices with UUID FK
CREATE TABLE question_choices (
  id              UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id     UUID    NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  option_key      TEXT    NOT NULL,
  label           TEXT    NOT NULL,
  display_order   INTEGER NOT NULL,
  UNIQUE (question_id, option_key)
);

-- 4. Recreate session_responses (question_type renamed to source, question_id now UUID)
CREATE TABLE session_responses (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id            UUID        NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  question_id           UUID        NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  selected_option_keys  TEXT[]      NOT NULL,
  source                TEXT        NOT NULL DEFAULT 'seed'
                        CHECK (source IN ('seed', 'ai')),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_session_responses_session_id ON session_responses(session_id);
CREATE INDEX idx_question_choices_question_id ON question_choices(question_id);

-- 5. Disable RLS (no direct browser access — all traffic through Express)
ALTER TABLE questions         DISABLE ROW LEVEL SECURITY;
ALTER TABLE question_choices  DISABLE ROW LEVEL SECURITY;
ALTER TABLE session_responses DISABLE ROW LEVEL SECURITY;

-- 6. Insert seed questions and their choices using a DO block to capture auto-generated UUIDs
DO $$
DECLARE
  v_situation   UUID;
  v_education   UUID;
  v_timeframe   UUID;
  v_schedule    UUID;
  v_environment UUID;
  v_support     UUID;
  v_location    UUID;
BEGIN
  INSERT INTO questions (title, hint, is_multi, layout, display_order, source, ai_id, question_category)
  VALUES ('Which best describes where you are right now?',
          'No wrong answer — this just helps us start in the right place.',
          FALSE, 'column', 1, 'seed', NULL, 'situation')
  RETURNING id INTO v_situation;

  INSERT INTO questions (title, hint, is_multi, layout, display_order, source, ai_id, question_category)
  VALUES ('What is your highest level of education?',
          'A GED works the same as a high-school diploma for most pathways.',
          FALSE, 'wrap', 2, 'seed', NULL, 'education')
  RETURNING id INTO v_education;

  INSERT INTO questions (title, hint, is_multi, layout, display_order, source, ai_id, question_category)
  VALUES ('How soon do you want to be working?',
          'Some roles start in weeks; others take years.',
          FALSE, 'wrap', 3, 'seed', NULL, 'timeframe')
  RETURNING id INTO v_timeframe;

  INSERT INTO questions (title, hint, is_multi, layout, display_order, source, ai_id, question_category)
  VALUES ('When can you realistically attend training?',
          'Pick all that apply.',
          TRUE, 'wrap', 4, 'seed', NULL, 'schedule')
  RETURNING id INTO v_schedule;

  INSERT INTO questions (title, hint, is_multi, layout, display_order, source, ai_id, question_category)
  VALUES ('What kind of work feels most like you?',
          'Trust your gut — this shapes the kind of pathway we recommend, not the only one.',
          FALSE, 'column', 5, 'seed', NULL, 'environment')
  RETURNING id INTO v_environment;

  INSERT INTO questions (title, hint, is_multi, layout, display_order, source, ai_id, question_category)
  VALUES ('Do you have any of these in place?',
          'Pick any that apply — including "None of these yet."',
          TRUE, 'wrap', 6, 'seed', NULL, 'support')
  RETURNING id INTO v_support;

  INSERT INTO questions (title, hint, is_multi, layout, display_order, source, ai_id, question_category)
  VALUES ('Where in the region are you based?',
          'We tailor program and employer recommendations to your area.',
          FALSE, 'wrap', 7, 'seed', NULL, 'location')
  RETURNING id INTO v_location;

  INSERT INTO question_choices (question_id, option_key, label, display_order) VALUES
    (v_situation, 'changer',   'Changing careers from another industry',          1),
    (v_situation, 'returning', 'Returning to work after a break',                 2),
    (v_situation, 'young',     'Just starting out or in school',                  3),
    (v_situation, 'displaced', 'Recently laid off or between jobs',               4),
    (v_situation, 'advancing', 'Already in healthcare, looking to advance',       5),
    (v_situation, 'newcomer',  'Newly arrived in the U.S.',                       6),

    (v_education, 'none', 'No diploma yet',                  1),
    (v_education, 'hs',   'High school / GED',               2),
    (v_education, 'some', 'Some college',                    3),
    (v_education, 'aa',   'Associate degree',                4),
    (v_education, 'ba',   'Bachelor''s degree',              5),
    (v_education, 'grad', 'Graduate degree',                 6),
    (v_education, 'intl', 'Degree earned outside the U.S.', 7),

    (v_timeframe, '3m',   'Within 3 months',                1),
    (v_timeframe, '6m',   '3 to 6 months',                  2),
    (v_timeframe, '12m',  '6 to 12 months',                 3),
    (v_timeframe, '2y',   '1 to 2 years',                   4),
    (v_timeframe, 'open', 'Open — willing to train longer',  5),

    (v_schedule, 'days',     'Weekday daytime',              1),
    (v_schedule, 'evenings', 'Weekday evenings',             2),
    (v_schedule, 'weekends', 'Weekends',                     3),
    (v_schedule, 'online',   'Online / asynchronous',        4),
    (v_schedule, 'hybrid',   'Hybrid',                       5),

    (v_environment, 'bedside', 'Hands-on care with patients',                         1),
    (v_environment, 'tech',    'Working with equipment, samples, or data',             2),
    (v_environment, 'admin',   'Coordinating, scheduling, helping the system run',     3),
    (v_environment, 'mh',      'Behavioral health, counseling, social support',        4),
    (v_environment, 'mix',     'A mix — I want to see options',                        5),

    (v_support, 'childcare', 'Reliable childcare',           1),
    (v_support, 'transit',   'Car or transit access',        2),
    (v_support, 'wioa',      'WIOA / workforce funding',     3),
    (v_support, 'esl',       'ESL support / translation',    4),
    (v_support, 'none',      'None of these yet',            5),

    (v_location, 'seattle',   'Seattle / Central',                               1),
    (v_location, 'north',     'North King (Shoreline, Bothell, Kirkland)',        2),
    (v_location, 'eastside',  'Eastside (Bellevue, Redmond, Issaquah)',           3),
    (v_location, 'south',     'South King (Renton, Kent, Federal Way, Auburn)',   4),
    (v_location, 'pierce',    'Pierce or Snohomish County',                       5),
    (v_location, 'elsewhere', 'Elsewhere in Washington',                          6);
END $$;

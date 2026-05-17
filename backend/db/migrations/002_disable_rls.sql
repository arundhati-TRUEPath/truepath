-- All Supabase access goes through the Express backend only.
-- No direct browser → Supabase connection exists. RLS is not needed.
ALTER TABLE sessions         DISABLE ROW LEVEL SECURITY;
ALTER TABLE questions        DISABLE ROW LEVEL SECURITY;
ALTER TABLE question_choices DISABLE ROW LEVEL SECURITY;
ALTER TABLE session_responses DISABLE ROW LEVEL SECURITY;

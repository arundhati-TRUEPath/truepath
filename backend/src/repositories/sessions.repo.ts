import { pool } from '../db/client';
import type { Session, SessionStatus } from '../types/sessions';
import type { IntakeAnswer } from '../types/intake';

export interface SessionQA {
  questionTitle: string;
  questionCategory: string;
  source: 'seed' | 'ai';
  selectedLabels: string[];
}

interface SessionRow {
  id: string;
  created_at: string;
  status: SessionStatus;
}

export async function createSession(): Promise<Session> {
  const { rows } = await pool.query<SessionRow>(
    `INSERT INTO sessions (status) VALUES ('in_progress') RETURNING id, created_at, status`,
  );
  const row = rows[0];
  return { id: row.id, createdAt: row.created_at, status: row.status };
}

export async function saveResponses(
  sessionId: string,
  answers: IntakeAnswer[],
  source: 'seed' | 'ai',
): Promise<void> {
  for (const a of answers) {
    await pool.query(
      `INSERT INTO session_responses (session_id, question_id, selected_option_keys, source)
       VALUES ($1, $2, $3, $4)`,
      [sessionId, a.questionId, a.optionIds, source],
    );
  }
}

export async function updateSessionStatus(
  sessionId: string,
  status: SessionStatus,
): Promise<void> {
  await pool.query(
    `UPDATE sessions SET status = $1, updated_at = now() WHERE id = $2`,
    [status, sessionId],
  );
}

interface QARow {
  question_title: string;
  question_category: string;
  display_order: number;
  source: 'seed' | 'ai';
  selected_option_keys: string[];
  choices: Array<{ option_key: string; label: string }>;
}

export async function getSessionQA(sessionId: string): Promise<SessionQA[]> {
  const { rows } = await pool.query<QARow>(
    `SELECT
       q.title            AS question_title,
       q.question_category,
       q.display_order,
       sr.source,
       sr.selected_option_keys,
       json_agg(json_build_object('option_key', qc.option_key, 'label', qc.label)) AS choices
     FROM session_responses sr
     JOIN questions q ON q.id = sr.question_id
     JOIN question_choices qc ON qc.question_id = q.id
     WHERE sr.session_id = $1
     GROUP BY q.title, q.question_category, q.display_order, sr.source, sr.selected_option_keys
     ORDER BY q.display_order`,
    [sessionId],
  );

  return rows.map((row) => ({
    questionTitle: row.question_title,
    questionCategory: row.question_category,
    source: row.source,
    selectedLabels: row.choices
      .filter((c) => row.selected_option_keys.includes(c.option_key))
      .map((c) => c.label),
  }));
}

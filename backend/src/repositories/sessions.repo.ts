import { db } from '../db/client';
import { DatabaseError } from '../errors/AppError';
import type { Session, SessionStatus } from '../types/sessions';
import type { IntakeAnswer } from '../types/intake';

interface SessionRow {
  id: string;
  created_at: string;
  status: SessionStatus;
}

export async function createSession(): Promise<Session> {
  const { data, error } = await db
    .from('sessions')
    .insert({ status: 'in_progress' })
    .select('id, created_at, status')
    .single();

  if (error) throw new DatabaseError(error.message);
  const row = data as SessionRow;
  return { id: row.id, createdAt: row.created_at, status: row.status };
}

export async function saveResponses(
  sessionId: string,
  answers: IntakeAnswer[],
  source: 'seed' | 'ai',
): Promise<void> {
  const rows = answers.map((a) => ({
    session_id: sessionId,
    question_id: a.questionId,
    selected_option_keys: a.optionIds,
    source,
  }));

  const { error } = await db.from('session_responses').insert(rows);
  if (error) throw new DatabaseError(error.message);
}

export async function updateSessionStatus(
  sessionId: string,
  status: SessionStatus,
): Promise<void> {
  const { error } = await db
    .from('sessions')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', sessionId);

  if (error) throw new DatabaseError(error.message);
}

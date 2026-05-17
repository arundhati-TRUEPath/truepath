import { db } from '../db/client';
import { DatabaseError } from '../errors/AppError';
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

interface ResponseRow {
  question_id: string;
  selected_option_keys: string[];
  source: 'seed' | 'ai';
}

interface QuestionWithChoices {
  id: string;
  title: string;
  question_category: string;
  display_order: number;
  question_choices: Array<{ option_key: string; label: string }>;
}

export async function getSessionQA(sessionId: string): Promise<SessionQA[]> {
  const { data: responses, error: rErr } = await db
    .from('session_responses')
    .select('question_id, selected_option_keys, source')
    .eq('session_id', sessionId);

  if (rErr) throw new DatabaseError(rErr.message);
  if (!responses || responses.length === 0) return [];

  const rows = responses as ResponseRow[];
  const questionIds = rows.map((r) => r.question_id);

  const { data: questions, error: qErr } = await db
    .from('questions')
    .select('id, title, question_category, display_order, question_choices(option_key, label)')
    .in('id', questionIds)
    .order('display_order', { ascending: true });

  if (qErr) throw new DatabaseError(qErr.message);
  if (!questions) return [];

  const responseMap = new Map(rows.map((r) => [r.question_id, r]));
  const result: SessionQA[] = [];

  for (const q of questions as QuestionWithChoices[]) {
    const r = responseMap.get(q.id);
    if (!r) continue;
    const selectedLabels = q.question_choices
      .filter((c) => r.selected_option_keys.includes(c.option_key))
      .map((c) => c.label);
    result.push({
      questionTitle: q.title,
      questionCategory: q.question_category,
      source: r.source,
      selectedLabels,
    });
  }

  return result;
}

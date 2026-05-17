import { db } from '../db/client';
import { DatabaseError } from '../errors/AppError';
import type { Question } from '../types/intake';
import type { FollowupQuestionInsert } from '../services/llm';

interface QuestionRow {
  id: string;
  title: string;
  hint: string;
  is_multi: boolean;
  layout: 'wrap' | 'column';
  display_order: number;
  question_choices: Array<{
    option_key: string;
    label: string;
    display_order: number;
  }>;
}

export async function getAllSeedQuestions(): Promise<Question[]> {
  const { data, error } = await db
    .from('questions')
    .select('id, title, hint, is_multi, layout, display_order, question_choices(option_key, label, display_order)')
    .eq('source', 'seed')
    .order('display_order', { ascending: true });

  if (error) throw new DatabaseError(error.message);
  if (!data) return [];

  return (data as QuestionRow[]).map((row) => ({
    id: row.id,
    title: row.title,
    hint: row.hint,
    ...(row.is_multi ? { multi: true } : {}),
    layout: row.layout,
    options: [...row.question_choices]
      .sort((a, b) => a.display_order - b.display_order)
      .map((c) => ({ id: c.option_key, label: c.label })),
  }));
}

export async function insertFollowupQuestions(questions: FollowupQuestionInsert[]): Promise<void> {
  for (const q of questions) {
    const { error: qErr } = await db.from('questions').insert({
      id: q.id,
      title: q.title,
      hint: q.hint,
      is_multi: q.isMulti,
      layout: q.layout,
      display_order: q.displayOrder,
      source: 'ai',
      ai_id: q.aiId,
      question_category: q.category,
    });
    if (qErr) throw new DatabaseError(qErr.message);

    const choiceRows = q.choices.map((c) => ({
      question_id: q.id,
      option_key: c.optionKey,
      label: c.label,
      display_order: c.displayOrder,
    }));
    const { error: cErr } = await db.from('question_choices').insert(choiceRows);
    if (cErr) throw new DatabaseError(cErr.message);
  }
}

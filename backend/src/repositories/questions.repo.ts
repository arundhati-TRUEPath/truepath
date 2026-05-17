import { db } from '../db/client';
import { DatabaseError } from '../errors/AppError';
import type { Question } from '../types/intake';

interface QuestionRow {
  id: string;
  title: string;
  hint: string | null;
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
    .eq('question_type', 'seed')
    .order('display_order', { ascending: true });

  if (error) throw new DatabaseError(error.message);
  if (!data) return [];

  return (data as QuestionRow[]).map((row) => ({
    id: row.id,
    title: row.title,
    ...(row.hint ? { hint: row.hint } : {}),
    ...(row.is_multi ? { multi: true } : {}),
    layout: row.layout,
    options: [...row.question_choices]
      .sort((a, b) => a.display_order - b.display_order)
      .map((c) => ({ id: c.option_key, label: c.label })),
  }));
}

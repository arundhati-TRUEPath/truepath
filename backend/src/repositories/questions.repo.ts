import { pool } from '../db/client';
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
  const { rows } = await pool.query<QuestionRow>(
    `SELECT
       q.id, q.title, q.hint, q.is_multi, q.layout, q.display_order,
       json_agg(
         json_build_object(
           'option_key', qc.option_key,
           'label', qc.label,
           'display_order', qc.display_order
         ) ORDER BY qc.display_order
       ) AS question_choices
     FROM questions q
     JOIN question_choices qc ON qc.question_id = q.id
     WHERE q.source = 'seed'
     GROUP BY q.id, q.title, q.hint, q.is_multi, q.layout, q.display_order
     ORDER BY q.display_order`,
  );

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    hint: row.hint,
    ...(row.is_multi ? { multi: true } : {}),
    layout: row.layout,
    options: row.question_choices.map((c) => ({ id: c.option_key, label: c.label })),
  }));
}

export async function insertFollowupQuestions(questions: FollowupQuestionInsert[]): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const q of questions) {
      await client.query(
        `INSERT INTO questions (id, title, hint, is_multi, layout, display_order, source, ai_id, question_category)
         VALUES ($1, $2, $3, $4, $5, $6, 'ai', $7, $8)`,
        [q.id, q.title, q.hint, q.isMulti, q.layout, q.displayOrder, q.aiId, q.category],
      );
      for (const c of q.choices) {
        await client.query(
          `INSERT INTO question_choices (question_id, option_key, label, display_order)
           VALUES ($1, $2, $3, $4)`,
          [q.id, c.optionKey, c.label, c.displayOrder],
        );
      }
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

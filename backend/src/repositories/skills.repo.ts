import { pool } from '../db/client';
import type { LlmSkill } from '../services/llm';

export interface ClientSkill {
  id: string;
  label: string;
  sub: string;
  confidence: 'high' | 'medium';
}

interface SkillRow {
  skill_id: string;
  label: string;
  sub: string;
  confidence: 'high' | 'medium';
  confirmed: boolean;
  rationale: string;
}

export async function saveSkills(sessionId: string, skills: LlmSkill[]): Promise<void> {
  for (const s of skills) {
    await pool.query(
      `INSERT INTO session_skills (session_id, skill_id, label, sub, confidence, rationale, confirmed)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [sessionId, s.id, s.label, s.sub, s.confidence, s.rationale, s.confidence === 'high'],
    );
  }
}

export async function getSkills(sessionId: string): Promise<ClientSkill[]> {
  const { rows } = await pool.query<SkillRow>(
    `SELECT skill_id, label, sub, confidence, confirmed, rationale
     FROM session_skills
     WHERE session_id = $1
     ORDER BY confidence DESC`,
    [sessionId],
  );
  return rows.map((r) => ({ id: r.skill_id, label: r.label, sub: r.sub, confidence: r.confidence }));
}

export async function getConfirmedSkills(sessionId: string): Promise<ClientSkill[]> {
  const { rows } = await pool.query<SkillRow>(
    `SELECT skill_id, label, sub, confidence, confirmed, rationale
     FROM session_skills
     WHERE session_id = $1 AND confirmed = true
     ORDER BY confidence DESC`,
    [sessionId],
  );
  return rows.map((r) => ({ id: r.skill_id, label: r.label, sub: r.sub, confidence: r.confidence }));
}

export async function confirmSkills(sessionId: string, confirmedIds: string[]): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `UPDATE session_skills SET confirmed = false WHERE session_id = $1`,
      [sessionId],
    );
    if (confirmedIds.length > 0) {
      await client.query(
        `UPDATE session_skills SET confirmed = true
         WHERE session_id = $1 AND skill_id = ANY($2::text[])`,
        [sessionId, confirmedIds],
      );
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

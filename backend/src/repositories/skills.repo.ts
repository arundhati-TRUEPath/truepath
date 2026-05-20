import { db } from '../db/client';
import { DatabaseError } from '../errors/AppError';
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
  const rows = skills.map((s) => ({
    session_id: sessionId,
    skill_id: s.id,
    label: s.label,
    sub: s.sub,
    confidence: s.confidence,
    rationale: s.rationale,
    confirmed: s.confidence === 'high',
  }));

  const { error } = await db.from('session_skills').insert(rows);
  if (error) throw new DatabaseError(error.message);
}

export async function getSkills(sessionId: string): Promise<ClientSkill[]> {
  const { data, error } = await db
    .from('session_skills')
    .select('skill_id, label, sub, confidence, confirmed, rationale')
    .eq('session_id', sessionId)
    .order('confidence', { ascending: false });

  if (error) throw new DatabaseError(error.message);
  if (!data) return [];

  return (data as SkillRow[]).map((r) => ({
    id: r.skill_id,
    label: r.label,
    sub: r.sub,
    confidence: r.confidence,
  }));
}

export async function getConfirmedSkills(sessionId: string): Promise<ClientSkill[]> {
  const { data, error } = await db
    .from('session_skills')
    .select('skill_id, label, sub, confidence, confirmed, rationale')
    .eq('session_id', sessionId)
    .eq('confirmed', true)
    .order('confidence', { ascending: false });

  if (error) throw new DatabaseError(error.message);
  if (!data) return [];

  return (data as SkillRow[]).map((r) => ({
    id: r.skill_id,
    label: r.label,
    sub: r.sub,
    confidence: r.confidence,
  }));
}

export async function confirmSkills(sessionId: string, confirmedIds: string[]): Promise<void> {
  const { error: resetErr } = await db
    .from('session_skills')
    .update({ confirmed: false })
    .eq('session_id', sessionId);
  if (resetErr) throw new DatabaseError(resetErr.message);

  if (confirmedIds.length === 0) return;

  const { error: setErr } = await db
    .from('session_skills')
    .update({ confirmed: true })
    .eq('session_id', sessionId)
    .in('skill_id', confirmedIds);
  if (setErr) throw new DatabaseError(setErr.message);
}

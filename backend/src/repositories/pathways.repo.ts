import { db } from '../db/client';
import { DatabaseError } from '../errors/AppError';

export interface CareerStep {
  role: string;
  meta: string;
  current?: boolean;
}

export type TagTone = 'sage' | 'amber' | 'clay' | '';

export interface PathwayTag {
  label: string;
  tone: TagTone;
}

export interface Pathway {
  id: string;
  rank: number;
  featured?: boolean;
  title: string;
  sub: string;
  wageRange: string;
  wageNote: string;
  confidence: number;
  tags: PathwayTag[];
  ladder: CareerStep[];
  why: string;
}

export interface Limitations {
  headline: string;
  summary: string;
  bullets: string[];
}

export interface SavedPathways {
  pathways: Pathway[];
  limitations: Limitations;
  sourceFiles: string[];
}

interface PathwayRow {
  pathways: Pathway[];
  limitations: Limitations;
  source_files: string[];
}

export async function getPathways(sessionId: string): Promise<SavedPathways | null> {
  const { data, error } = await db
    .from('session_pathways')
    .select('pathways, limitations, source_files')
    .eq('session_id', sessionId)
    .maybeSingle();

  if (error) throw new DatabaseError(error.message);
  if (!data) return null;

  const row = data as PathwayRow;
  return {
    pathways: row.pathways,
    limitations: row.limitations,
    sourceFiles: row.source_files ?? [],
  };
}

export async function savePathways(sessionId: string, saved: SavedPathways): Promise<void> {
  const row = {
    session_id: sessionId,
    pathways: saved.pathways,
    limitations: saved.limitations,
    source_files: saved.sourceFiles,
    updated_at: new Date().toISOString(),
  };

  const { error } = await db
    .from('session_pathways')
    .upsert(row, { onConflict: 'session_id' });

  if (error) throw new DatabaseError(error.message);
}

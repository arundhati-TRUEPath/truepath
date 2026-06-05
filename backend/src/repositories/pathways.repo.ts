import { pool } from '../db/client';

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
  const { rows } = await pool.query<PathwayRow>(
    `SELECT pathways, limitations, source_files
     FROM session_pathways
     WHERE session_id = $1`,
    [sessionId],
  );
  if (rows.length === 0) return null;
  const row = rows[0];
  return {
    pathways: row.pathways,
    limitations: row.limitations,
    sourceFiles: row.source_files ?? [],
  };
}

export async function savePathways(sessionId: string, saved: SavedPathways): Promise<void> {
  await pool.query(
    `INSERT INTO session_pathways (session_id, pathways, limitations, source_files, updated_at)
     VALUES ($1, $2, $3, $4, now())
     ON CONFLICT (session_id) DO UPDATE
       SET pathways     = EXCLUDED.pathways,
           limitations  = EXCLUDED.limitations,
           source_files = EXCLUDED.source_files,
           updated_at   = now()`,
    [
      sessionId,
      JSON.stringify(saved.pathways),
      JSON.stringify(saved.limitations),
      saved.sourceFiles,
    ],
  );
}

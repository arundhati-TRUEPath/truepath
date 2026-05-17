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

export interface PathwayResponse {
  pathways: Pathway[];
  limitations: Limitations;
}

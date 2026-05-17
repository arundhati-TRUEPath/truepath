'use client';

import type { Skill } from '@/lib/types/skills';

interface SkillsAssessmentState {
  skills: Skill[];
  rationale: string;
  confirmedIds: string[];
  isLoading: boolean;
  toggle: (id: string) => void;
  confirm: () => void;
}

export function useSkillsAssessment(): SkillsAssessmentState {
  throw new Error('not implemented');
}

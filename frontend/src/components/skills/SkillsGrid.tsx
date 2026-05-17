'use client';

import type { Skill } from '@/lib/types/skills';

interface SkillsGridProps {
  skills: Skill[];
  confirmedIds: string[];
  onToggle: (id: string) => void;
}

export default function SkillsGrid({ skills, confirmedIds, onToggle }: SkillsGridProps) {
  return null;
}

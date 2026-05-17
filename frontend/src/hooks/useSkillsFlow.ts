'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSessionStore } from '@/lib/store/session';
import type { Skill } from '@/lib/types/skills';

const ALL_SKILLS: Skill[] = [
  { id: 'listening',  label: 'Active listening',               sub: 'from caregiving + customer-facing work' },
  { id: 'comm',       label: 'Patient-style communication',    sub: 'inferred from your service background' },
  { id: 'time',       label: 'Time management',                sub: 'from balancing multiple responsibilities' },
  { id: 'safety',     label: 'Safety & hygiene awareness',     sub: 'common across caregiving roles' },
  { id: 'doc',        label: 'Documentation & follow-through', sub: 'transfers from admin / retail' },
  { id: 'empathy',    label: 'Empathy under pressure',         sub: 'core to your stated priorities' },
  { id: 'team',       label: 'Team coordination',              sub: 'from shift-based work' },
  { id: 'multitask',  label: 'Multitasking calmly',            sub: 'from prior fast-paced environments' },
  { id: 'deescalate', label: 'De-escalation',                  sub: 'from front-line interactions' },
  { id: 'vitals',     label: 'Basic vital-signs concept',      sub: 'foundational — you can build on it' },
  { id: 'tech',       label: 'Comfort with simple tech',       sub: 'inferred from intake responses' },
  { id: 'bilingual',  label: 'Bilingual communication',        sub: 'high value in WA healthcare settings' },
];

interface SkillsFlowState {
  isLoading: boolean;
  skills: Skill[];
  confirmedIds: string[];
  toggle: (id: string) => void;
  confirm: () => void;
  goBack: () => void;
}

export function useSkillsFlow(): SkillsFlowState {
  const router = useRouter();
  const { setConfirmedSkillIds } = useSessionStore();
  const [isLoading, setIsLoading] = useState(true);
  const [confirmedIds, setConfirmedIds] = useState<string[]>(() =>
    ALL_SKILLS.slice(0, 8).map((s) => s.id)
  );

  useEffect(() => {
    const t = setTimeout(() => setIsLoading(false), 1100);
    return () => clearTimeout(t);
  }, []);

  function toggle(id: string): void {
    setConfirmedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function confirm(): void {
    setConfirmedSkillIds(confirmedIds);
    router.push('/pathways');
  }

  function goBack(): void {
    router.push('/intake');
  }

  return { isLoading, skills: ALL_SKILLS, confirmedIds, toggle, confirm, goBack };
}

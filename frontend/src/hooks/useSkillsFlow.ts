'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation } from '@tanstack/react-query';
import { inferSkills, confirmSkills } from '@/lib/api/endpoints';
import { useSessionStore } from '@/lib/store/session';
import type { Skill } from '@/lib/types/skills';
import type { AppError } from '@/lib/api/client';

interface SkillsFlowState {
  isLoading: boolean;
  isConfirming: boolean;
  skills: Skill[];
  rationale: string;
  confirmedIds: string[];
  error: AppError | null;
  toggle: (id: string) => void;
  confirm: () => void;
  goBack: () => void;
}

export function useSkillsFlow(): SkillsFlowState {
  const router = useRouter();
  const { sessionId, setInferredSkills, setConfirmedSkillIds } = useSessionStore();
  const [confirmedIds, setConfirmedIds] = useState<string[]>([]);

  const skillsQuery = useQuery({
    queryKey: ['skills', sessionId],
    queryFn: () => inferSkills(sessionId),
    enabled: !!sessionId,
    staleTime: Infinity,
    retry: (count, err) => count < 1 && (err as AppError).retryable === true,
  });

  useEffect(() => {
    if (!skillsQuery.data) return;
    const highIds = skillsQuery.data.skills
      .filter((s) => s.confidence === 'high')
      .map((s) => s.id);
    setConfirmedIds(highIds);
    setInferredSkills(skillsQuery.data.skills);
  }, [skillsQuery.data, setInferredSkills]);

  const confirmMutation = useMutation<void, AppError, void>({
    mutationFn: () => confirmSkills(sessionId, confirmedIds),
    onSuccess: () => {
      setConfirmedSkillIds(confirmedIds);
      router.push('/pathways');
    },
  });

  function toggle(id: string): void {
    setConfirmedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  return {
    isLoading: skillsQuery.isLoading,
    isConfirming: confirmMutation.isPending,
    skills: skillsQuery.data?.skills ?? [],
    rationale: skillsQuery.data?.rationale ?? '',
    confirmedIds,
    error: skillsQuery.error as AppError | null,
    toggle,
    confirm: () => { confirmMutation.mutate(); },
    goBack: () => { router.push('/intake'); },
  };
}

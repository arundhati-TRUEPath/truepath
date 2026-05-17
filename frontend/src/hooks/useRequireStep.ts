'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSessionStore } from '@/lib/store/session';

type Step = 'skills' | 'pathways' | 'plan';

const stepGuards: Record<Step, (s: ReturnType<typeof useSessionStore.getState>) => boolean> = {
  skills:   (s) => s.intakeAnswers.length > 0,
  pathways: (s) => s.confirmedSkillIds.length > 0,
  plan:     (s) => s.pathways.length > 0,
};

export function useRequireStep(step: Step): void {
  const router = useRouter();
  const store = useSessionStore();

  useEffect(() => {
    if (!stepGuards[step](store)) {
      router.replace('/intake');
    }
  }, [store, step, router]);
}

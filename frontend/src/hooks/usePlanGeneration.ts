'use client';

import type { Plan } from '@/lib/types/plan';

interface PlanGenerationState {
  plan: Plan | null;
  sessionId: string;
  isLoading: boolean;
  download: () => void;
}

export function usePlanGeneration(): PlanGenerationState {
  throw new Error('not implemented');
}

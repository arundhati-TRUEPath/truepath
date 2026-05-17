'use client';

import type { IntakeAnswer, Question } from '@/lib/types/intake';

interface IntakeFlowState {
  questions: Question[];
  answers: IntakeAnswer[];
  isLoading: boolean;
  isSubmitting: boolean;
  canContinue: boolean;
  submitAnswer: (questionId: string, optionId: string, multi: boolean) => void;
  finish: () => void;
}

export function useIntakeFlow(): IntakeFlowState {
  throw new Error('not implemented');
}

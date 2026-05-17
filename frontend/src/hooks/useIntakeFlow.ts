'use client';

import { useState, useCallback } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { fetchSeedQuestions, submitSeedAnswers, startSession } from '@/lib/api/endpoints';
import { useSessionStore } from '@/lib/store/session';
import type { IntakeAnswer, Question } from '@/lib/types/intake';
import type { AppError } from '@/lib/api/client';

const SEED_COUNT = 7;

interface IntakeFlowState {
  questions: Question[];
  answers: Record<string, string[]>;
  phase: 'seed' | 'followup' | 'done';
  answeredCount: number;
  totalCount: number;
  seedAnswered: boolean;
  allFollowupsAnswered: boolean;
  isLoadingQuestions: boolean;
  isSubmittingSeed: boolean;
  questionsError: AppError | null;
  followupError: AppError | null;
  pick: (questionId: string, optionId: string, multi: boolean) => void;
  submitSeed: () => void;
  finish: () => void;
}

export function useIntakeFlow(): IntakeFlowState {
  const { sessionId, setSessionId, setIntakeAnswers, setFollowupQuestions } = useSessionStore();
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [followupQuestions, setLocalFollowups] = useState<Question[]>([]);
  const [phase, setPhase] = useState<'seed' | 'followup' | 'done'>('seed');

  const sessionQuery = useQuery({
    queryKey: ['session'],
    queryFn: async () => {
      const result = await startSession();
      setSessionId(result.sessionId);
      return result;
    },
    enabled: !sessionId,
    staleTime: Infinity,
    retry: 2,
  });

  const questionsQuery = useQuery({
    queryKey: ['questions', 'seed'],
    queryFn: fetchSeedQuestions,
    staleTime: Infinity,
    retry: 2,
  });

  const followupMutation = useMutation<
    { questions: Question[] },
    AppError,
    { sid: string; ans: IntakeAnswer[] }
  >({
    mutationFn: ({ sid, ans }) => submitSeedAnswers(sid, ans),
    onSuccess: (data) => {
      setLocalFollowups(data.questions);
      setFollowupQuestions(data.questions);
      setPhase('followup');
    },
  });

  const pick = useCallback(
    (questionId: string, optionId: string, multi: boolean) => {
      setAnswers((prev) => {
        const cur = prev[questionId] ?? [];
        if (multi) {
          const next = cur.includes(optionId)
            ? cur.filter((x) => x !== optionId)
            : [...cur, optionId];
          return { ...prev, [questionId]: next };
        }
        return { ...prev, [questionId]: [optionId] };
      });
    },
    [],
  );

  const seedQuestions = questionsQuery.data ?? [];

  const seedAnswered = seedQuestions.length === SEED_COUNT
    ? seedQuestions.every((q) => (answers[q.id] ?? []).length > 0)
    : false;

  const allFollowupsAnswered =
    phase === 'followup'
      ? followupQuestions.every((q) => (answers[q.id] ?? []).length > 0)
      : false;

  const visibleQuestions: Question[] =
    phase === 'seed' ? seedQuestions : [...seedQuestions, ...followupQuestions];

  const answeredCount = visibleQuestions.filter((q) => (answers[q.id] ?? []).length > 0).length;
  const totalCount = phase === 'seed' ? SEED_COUNT : SEED_COUNT + followupQuestions.length;

  function submitSeed() {
    const sid = sessionId || sessionQuery.data?.sessionId;
    if (!sid) return;
    const intakeAnswers: IntakeAnswer[] = seedQuestions.map((q) => ({
      questionId: q.id,
      optionIds: answers[q.id] ?? [],
    }));
    setIntakeAnswers(intakeAnswers);
    followupMutation.mutate({ sid, ans: intakeAnswers });
  }

  function finish() {
    const allAnswers: IntakeAnswer[] = visibleQuestions.map((q) => ({
      questionId: q.id,
      optionIds: answers[q.id] ?? [],
    }));
    setIntakeAnswers(allAnswers);
    setPhase('done');
  }

  return {
    questions: visibleQuestions,
    answers,
    phase,
    answeredCount,
    totalCount,
    seedAnswered,
    allFollowupsAnswered,
    isLoadingQuestions: questionsQuery.isLoading || sessionQuery.isLoading,
    isSubmittingSeed: followupMutation.isPending,
    questionsError: questionsQuery.error as AppError | null,
    followupError: followupMutation.error,
    pick,
    submitSeed,
    finish,
  };
}

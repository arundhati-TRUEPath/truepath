'use client';

import type { Question } from '@/lib/types/intake';

interface QuestionCardProps {
  question: Question;
  index: number;
  value: string[];
  onPick: (optionId: string) => void;
}

export default function QuestionCard({ question, index, value, onPick }: QuestionCardProps) {
  return null;
}

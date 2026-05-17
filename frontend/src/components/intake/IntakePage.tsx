'use client';

import type { IntakeAnswer } from '@/lib/types/intake';

interface IntakePageProps {
  onComplete: (answers: IntakeAnswer[]) => void;
}

export default function IntakePage({ onComplete }: IntakePageProps) {
  return null;
}

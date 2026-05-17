'use client';

type WizardStep = 'intake' | 'skills' | 'pathways' | 'plan';

interface TopBarProps {
  currentStep?: WizardStep;
}

export default function TopBar({ currentStep }: TopBarProps) {
  return null;
}

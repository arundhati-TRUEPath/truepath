'use client';

import Link from 'next/link';
import BrandMark from './BrandMark';

const STEPS = [
  { id: 'intake',   label: 'Intake' },
  { id: 'skills',   label: 'Skills' },
  { id: 'pathways', label: 'Pathways' },
  { id: 'plan',     label: 'Plan' },
] as const;

type WizardStep = (typeof STEPS)[number]['id'];

interface TopBarProps {
  currentStep?: WizardStep;
}

export default function TopBar({ currentStep }: TopBarProps): React.ReactElement {
  const stepIndex = STEPS.findIndex((s) => s.id === currentStep);

  return (
    <header className="topbar">
      <Link href="/" className="brand">
        <BrandMark size={48} />
        <div>
          <div className="brand-name">TRUE Path Navigator</div>
          <div className="brand-sub"><em>Clear pathways. Better careers.</em></div>
        </div>
      </Link>

      <div className="topbar-meta">
        {currentStep ? (
          <div className="stepper" aria-label="Progress through the four steps">
            {STEPS.map((step, i) => {
              const isDone = i < stepIndex;
              const isActive = step.id === currentStep;
              const state = isDone ? 'done' : isActive ? 'active' : '';
              return (
                <div key={step.id} style={{ display: 'contents' }}>
                  <div className={`step ${state}`}>
                    <span className="num">
                      {isDone ? '✓' : i + 1}
                    </span>
                    <span>{step.label}</span>
                  </div>
                  {i < STEPS.length - 1 && (
                    <div className={`sep ${isDone ? 'done' : ''}`} />
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <span><span className="dot" />Session ready · no sign-in needed</span>
        )}
      </div>
    </header>
  );
}

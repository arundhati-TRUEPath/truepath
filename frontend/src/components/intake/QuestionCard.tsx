'use client';

import type { Question } from '@/lib/types/intake';
import PillButton from '@/components/shared/PillButton';

interface QuestionCardProps {
  question: Question;
  index: number;
  value: string[];
  onPick: (optionId: string) => void;
  isFollowup?: boolean;
}

export default function QuestionCard({
  question,
  index,
  value,
  onPick,
  isFollowup = false,
}: QuestionCardProps): React.ReactElement {
  const answered = value.length > 0;

  return (
    <section
      id={`q-${question.id}`}
      className={[
        'q-block',
        answered ? 'is-answered' : '',
        isFollowup ? 'is-followup' : '',
      ].filter(Boolean).join(' ')}
    >
      <header className="q-block-head">
        <div className="q-block-num">
          {isFollowup
            ? <em>AI follow-up</em>
            : <>Question <em>{String(index + 1).padStart(2, '0')}</em></>
          }
        </div>

        {!isFollowup && <span className="tag sage"><span className="dot" />Required</span>}
        {isFollowup && <span className="tag"><span className="dot" />Optional</span>}
        {question.multi && <span className="tag"><span className="dot" />Choose any</span>}

        {answered && !question.multi && (
          <span className="q-answered-mark" aria-hidden="true">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M2.5 6.2l2.4 2.4 4.6-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        )}
      </header>

      {isFollowup && question.rationale && (
        <div className="followup-banner">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" />
            <path d="M8 4.5v4M8 11h.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <span>{question.rationale}</span>
        </div>
      )}

      <h3 className="q-block-title">{question.title}</h3>
      {question.hint && <p className="q-block-hint">{question.hint}</p>}

      <div className={`q-options${question.layout === 'column' ? ' column' : ''}`}>
        {question.options.map((opt) => (
          <PillButton
            key={opt.id}
            pressed={value.includes(opt.id)}
            onClick={() => onPick(opt.id)}
            columnLayout={question.layout === 'column'}
          >
            {opt.label}
          </PillButton>
        ))}
      </div>
    </section>
  );
}

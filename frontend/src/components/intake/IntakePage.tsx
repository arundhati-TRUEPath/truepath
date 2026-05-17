'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { useIntakeFlow } from '@/hooks/useIntakeFlow';
import QuestionCard from './QuestionCard';
import ProgressBar from './ProgressBar';

const SEED_COUNT = 7;
const IS_DEV = process.env.NODE_ENV !== 'production';

export default function IntakePage(): React.ReactElement {
  const router = useRouter();
  const {
    questions,
    answers,
    phase,
    answeredCount,
    totalCount,
    seedAnswered,
    allFollowupsAnswered,
    isLoadingQuestions,
    isSubmittingSeed,
    isSubmittingFollowup,
    questionsError,
    followupError,
    pick,
    finish,
  } = useIntakeFlow();

  const followupRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (phase === 'followup' && followupRef.current) {
      const el = followupRef.current;
      const y = el.getBoundingClientRect().top + window.scrollY - 90;
      window.scrollTo({ top: y, behavior: 'smooth' });
    }
  }, [phase]);

  useEffect(() => {
    if (phase === 'done') {
      router.push('/skills');
    }
  }, [phase, router]);

  const remaining = totalCount - answeredCount;

  if (questionsError) {
    return (
      <main className="page page-narrow step-frame" style={{ textAlign: 'center', paddingTop: 80 }}>
        <p style={{ color: 'var(--ink)', fontWeight: 500 }}>Couldn't load questions.</p>
        <p style={{ fontSize: 13, color: 'var(--mute)', marginTop: 8 }}>{questionsError.message}</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          style={{ background: 'none', border: 0, color: 'var(--sage)', fontSize: 13, cursor: 'pointer', textDecoration: 'underline', marginTop: 12 }}
        >
          Try again
        </button>
      </main>
    );
  }

  return (
    <main className="page page-narrow step-frame">
      <div className="subhead">
        <div className="crumbs">
          <em>Step 1</em>
          <span>·</span>
          <span>Intake</span>
        </div>
        <ProgressBar answered={answeredCount} total={totalCount} />
      </div>

      <div className="intake-intro">
        <h2 className="display">A few honest questions.</h2>
        <p className="lede">
          The first <em>seven</em> are the essentials we need to recommend a real fit — they
          take about three minutes. After that, a couple of optional follow-ups help sharpen
          the result. Tap the choice that fits best; you can change any answer until you continue.
        </p>
      </div>

      {isLoadingQuestions ? (
        <div className="q-stack">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="skeleton-pulse"
              style={{
                height: 160,
                borderRadius: 18,
                background: 'var(--card-tint)',
                border: '1px solid var(--line)',
                opacity: 0.5 + i * 0.1,
                animationDelay: `${i * 0.12}s`,
              }}
            />
          ))}
        </div>
      ) : (
        <div className="q-stack">
          {questions.slice(0, SEED_COUNT).map((q, i) => (
            <QuestionCard
              key={q.id}
              question={q}
              index={i}
              value={answers[q.id] ?? []}
              onPick={(optId) => pick(q.id, optId, !!q.multi)}
            />
          ))}

          {isSubmittingSeed && (
            <div className="q-thinking-row">
              <span className="ai-thinking">
                <span className="pulse" />
                Looking at your answers for a useful follow-up…
              </span>
            </div>
          )}

          {phase === 'followup' && (
            <div ref={followupRef}>
              {questions.slice(SEED_COUNT).map((q, i) => (
                <div key={q.id} style={{ marginTop: 28 }}>
                  <QuestionCard
                    question={q}
                    index={SEED_COUNT + i}
                    value={answers[q.id] ?? []}
                    onPick={(optId) => pick(q.id, optId, !!q.multi)}
                    isFollowup
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {followupError && (
        <p style={{ marginTop: 16, fontSize: 13, color: '#c0392b' }}>{followupError.message}</p>
      )}

      <div className="intake-foot">
        <div className="intake-foot-meta">
          {phase === 'seed' && !seedAnswered && !isSubmittingSeed && (
            <span>{remaining} essential {remaining === 1 ? 'question' : 'questions'} left.</span>
          )}
          {isSubmittingSeed && (
            <span>Personalizing your follow-up questions…</span>
          )}
          {phase === 'followup' && !isSubmittingSeed && remaining > 0 && (
            <span>{remaining} more to unlock your skills.</span>
          )}
          {phase === 'followup' && !isSubmittingSeed && remaining === 0 && (
            <span>All done — tap to see your skills.</span>
          )}
        </div>

        <button
          type="button"
          onClick={finish}
          disabled={phase !== 'followup' || !allFollowupsAnswered || isSubmittingSeed || isSubmittingFollowup}
          className="btn accent"
        >
          {isSubmittingFollowup ? 'Saving…' : 'See my skills'}
          {!isSubmittingFollowup && (
            <svg className="btn-arrow" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </button>
      </div>

      <div className="intake-fineprint">
        Your answers stay on this device. No account is created.
      </div>

      {IS_DEV && (
        <div style={{ position: 'fixed', bottom: 16, left: 16, display: 'flex', gap: 8, zIndex: 9999 }}>
          <button
            type="button"
            onClick={() => {
              questions.slice(0, SEED_COUNT).forEach((q) => {
                const first = q.options[0];
                if (first) pick(q.id, first.id, !!q.multi);
              });
            }}
            disabled={isLoadingQuestions || questions.length < SEED_COUNT}
            style={{ fontSize: 11, padding: '4px 10px', background: '#1a1a2e', color: '#7ecaff', border: '1px solid #7ecaff', borderRadius: 6, cursor: 'pointer', fontFamily: 'monospace' }}
          >
            DEV: fill seed
          </button>
          {phase === 'followup' && questions.length > SEED_COUNT && (
            <button
              type="button"
              onClick={() => {
                questions.slice(SEED_COUNT).forEach((q) => {
                  const first = q.options[0];
                  if (first) pick(q.id, first.id, !!q.multi);
                });
              }}
              style={{ fontSize: 11, padding: '4px 10px', background: '#1a1a2e', color: '#7ecaff', border: '1px solid #7ecaff', borderRadius: 6, cursor: 'pointer', fontFamily: 'monospace' }}
            >
              DEV: fill followup
            </button>
          )}
        </div>
      )}
    </main>
  );
}

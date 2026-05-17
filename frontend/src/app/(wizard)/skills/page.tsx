'use client';

import { useSkillsFlow } from '@/hooks/useSkillsFlow';
import SkillsGrid from '@/components/skills/SkillsGrid';
import SkillsRationale from '@/components/skills/SkillsRationale';

export default function SkillsPage(): React.ReactElement {
  const { isLoading, isConfirming, skills, rationale, confirmedIds, error, toggle, confirm, goBack } = useSkillsFlow();

  if (error) {
    return (
      <main className="page page-narrow step-frame" style={{ textAlign: 'center', paddingTop: 80 }}>
        <p style={{ color: 'var(--ink)', fontWeight: 500 }}>Couldn't load your skills.</p>
        <p style={{ fontSize: 13, color: 'var(--mute)', marginTop: 8 }}>{error.message}</p>
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

  if (isLoading) {
    return (
      <main className="page page-narrow step-frame" style={{ textAlign: 'center', paddingTop: 120 }}>
        <span className="ai-thinking">
          <span className="pulse" />
          Reading your intake answers…
        </span>
        <h2 className="display" style={{ marginTop: 24, fontSize: 36 }}>
          Pulling together the skills we see in you.
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginTop: 40, maxWidth: 680, marginInline: 'auto' }}>
          {Array.from({ length: 9 }).map((_, i) => (
            <div
              key={i}
              className="skeleton-pulse"
              style={{ height: 56, borderRadius: 14, background: 'var(--card-tint)', border: '1px solid var(--line)', opacity: 0.6 + (i % 3) * 0.1, animationDelay: `${i * 0.1}s` }}
            />
          ))}
        </div>
      </main>
    );
  }

  return (
    <main className="page step-frame">
      <div className="section-head">
        <div>
          <div className="eyebrow">Step 2 · Skills</div>
          <h2 className="display" style={{ marginTop: 6 }}>Here's what we see in you.</h2>
        </div>
        <div className="right">
          <span style={{ color: 'var(--ink)', fontFamily: 'var(--font-display)' }}>{confirmedIds.length}</span>
          {' / '}{skills.length} skills confirmed
        </div>
      </div>

      <SkillsRationale
        rationale={rationale}
        confirmedCount={confirmedIds.length}
        totalCount={skills.length}
      />

      <SkillsGrid skills={skills} confirmedIds={confirmedIds} onToggle={toggle} />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 32, gap: 12, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 13, color: 'var(--mute)' }}>
          Skills are how the system finds your fit — less is fine, but at least 3 is recommended.
        </span>
        <div style={{ display: 'flex', gap: 10 }}>
          <button type="button" className="btn secondary" onClick={goBack}>
            <span>Back to intake</span>
            <svg className="btn-arrow" viewBox="0 0 16 16" fill="none" aria-hidden="true" style={{ transform: 'rotate(180deg)' }}>
              <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <button type="button" className="btn accent" onClick={confirm} disabled={confirmedIds.length < 3 || isConfirming}>
            Show me pathways
            <svg className="btn-arrow" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </div>
    </main>
  );
}

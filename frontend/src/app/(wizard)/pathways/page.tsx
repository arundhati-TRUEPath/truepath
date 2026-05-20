'use client';

import { usePathwaysFlow } from '@/hooks/usePathwaysFlow';
import PathwayCard from '@/components/pathways/PathwayCard';
import LimitationsPanel from '@/components/pathways/LimitationsPanel';

export default function PathwaysPage(): React.ReactElement {
  const { isLoading, pathways, limitations, expandedIds, error, toggleExpanded, confirm, goBack, downloadPdf } = usePathwaysFlow();

  if (error) {
    return (
      <main className="page page-narrow step-frame" style={{ textAlign: 'center', paddingTop: 80 }}>
        <p style={{ color: 'var(--ink)', fontWeight: 500 }}>Couldn&apos;t generate your pathways.</p>
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
      <main className="page step-frame" style={{ textAlign: 'center', paddingTop: 120 }}>
        <span className="ai-thinking">
          <span className="pulse" />
          Ranking three pathways for you…
        </span>
        <h2 className="display" style={{ marginTop: 24, fontSize: 36 }}>
          Matching your skills against verified WA workforce data.
        </h2>
      </main>
    );
  }

  return (
    <main className="page step-frame">
      <div className="section-head">
        <div>
          <div className="eyebrow">Step 3 · Career map</div>
          <h2 className="display" style={{ marginTop: 6 }}>Three pathways that fit.</h2>
        </div>
        <div className="right">
          Ranked by fit · <span style={{ color: 'var(--ink)', fontFamily: 'var(--font-display)' }}>King County, May 2026</span>
        </div>
      </div>

      <LimitationsPanel limitations={limitations} />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 18, marginTop: 28 }}>
        {pathways.map((p) => (
          <PathwayCard
            key={p.id}
            pathway={p}
            expanded={!!expandedIds[p.id]}
            onToggle={() => toggleExpanded(p.id)}
          />
        ))}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 36, gap: 12, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 13, color: 'var(--mute)' }}>
          All three pathways are valid. The plan you build next focuses on Pathway 1 with the others as alternates.
        </span>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button type="button" className="btn secondary" onClick={goBack}>
            <span>Back to skills</span>
            <svg className="btn-arrow" viewBox="0 0 16 16" fill="none" aria-hidden="true" style={{ transform: 'rotate(180deg)' }}>
              <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <button type="button" className="btn secondary" onClick={downloadPdf}>
            <span>Download PDF</span>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M8 2v9m0 0l-3-3m3 3l3-3M3 13h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <button type="button" className="btn accent" onClick={confirm}>
            Build my plan
            <svg className="btn-arrow" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </div>
    </main>
  );
}

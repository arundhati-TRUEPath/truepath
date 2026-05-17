'use client';

import { usePlanFlow } from '@/hooks/usePlanFlow';
import PlanPreview from '@/components/plan/PlanPreview';

export default function PlanPage(): React.ReactElement {
  const { isLoading, generatedDate, goBack, restart, downloadPdf, emailPlan } = usePlanFlow();

  if (isLoading) {
    return (
      <main className="page page-narrow step-frame" style={{ textAlign: 'center', paddingTop: 120 }}>
        <span className="ai-thinking">
          <span className="pulse" />
          Building your personalized career plan…
        </span>
        <h2 className="display" style={{ marginTop: 24, fontSize: 36 }}>
          Writing your action plan.
        </h2>
        <p className="lede" style={{ margin: '12px auto 0' }}>
          One page, three next steps, and a list of resources to take with you.
        </p>
      </main>
    );
  }

  return (
    <main className="page step-frame">
      <div className="section-head">
        <div>
          <div className="eyebrow">Step 4 · Plan</div>
          <h2 className="display" style={{ marginTop: 6 }}>Your action plan is ready.</h2>
        </div>
        <div className="right">Generated {generatedDate}</div>
      </div>

      <PlanPreview />

      <div className="plan-actions">
        <button type="button" className="btn accent" onClick={downloadPdf}>
          <span>Download PDF</span>
          <svg className="btn-arrow" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <button type="button" className="btn secondary" onClick={() => window.print()}>
          <span>Print</span>
        </button>
        <button type="button" className="btn secondary" onClick={emailPlan}>
          <span>Email to me</span>
        </button>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 40, gap: 12, flexWrap: 'wrap' }}>
        <button type="button" className="btn secondary" onClick={goBack}>
          Back to pathways
          <svg className="btn-arrow" viewBox="0 0 16 16" fill="none" aria-hidden="true" style={{ transform: 'rotate(180deg)' }}>
            <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <button type="button" onClick={restart} style={{ background: 'transparent', border: 0, color: 'var(--mute)', cursor: 'pointer', fontSize: 13, textDecoration: 'underline', textUnderlineOffset: 4, textDecorationColor: 'var(--line-strong)' }}>
          Start a new session
        </button>
      </div>
    </main>
  );
}

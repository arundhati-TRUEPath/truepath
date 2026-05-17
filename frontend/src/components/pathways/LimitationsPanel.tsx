import type { Limitations } from '@/lib/types/pathways';

interface LimitationsPanelProps {
  limitations: Limitations;
}

export default function LimitationsPanel({ limitations }: LimitationsPanelProps): React.ReactElement {
  return (
    <div className="limitations" role="region" aria-label="Honest limits to plan around">
      <div className="icon" aria-hidden="true">
        <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
          <path d="M10 2L1.5 17h17L10 2z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
          <path d="M10 8v4M10 14.5h.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </div>
      <div style={{ flex: 1 }}>
        <h4>{limitations.headline}</h4>
        <p>{limitations.summary}</p>
        <ul>
          {limitations.bullets.map((b, i) => <li key={i}>{b}</li>)}
        </ul>
      </div>
    </div>
  );
}

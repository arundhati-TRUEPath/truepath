'use client';

import type { Pathway } from '@/lib/types/pathways';
import CareerLadder from './CareerLadder';

interface PathwayCardProps {
  pathway: Pathway;
  expanded: boolean;
  onToggle: () => void;
}

export default function PathwayCard({ pathway, expanded, onToggle }: PathwayCardProps): React.ReactElement {
  return (
    <article className={`pathway${pathway.featured ? ' featured' : ''}`}>
      <div className="pathway-rank">{String(pathway.rank).padStart(2, '0')}</div>

      <div className="pathway-head">
        <div>
          <h3 className="pathway-title">{pathway.title}</h3>
          <div className="pathway-sub">{pathway.sub}</div>
          <div style={{ marginTop: 12 }}>
            <span className="confidence" title={`Fit confidence ${pathway.confidence}/5`}>
              <span className="bars" aria-hidden="true">
                {[1, 2, 3, 4, 5].map((n) => (
                  <i key={n} className={n <= pathway.confidence ? 'on' : ''} />
                ))}
              </span>
              <span>Fit confidence</span>
            </span>
          </div>
        </div>
        <div className="pathway-wage">
          <div className="val">{pathway.wageRange}</div>
          <div className="unit">{pathway.wageNote}</div>
        </div>
      </div>

      <CareerLadder steps={pathway.ladder} />

      <div className="pathway-tags">
        {pathway.tags.map((t, i) => (
          <span key={i} className={`tag ${t.tone}`}>
            <span className="dot" />
            {t.label}
          </span>
        ))}
      </div>

      <div className="pathway-foot">
        <button className="why-toggle" onClick={onToggle} aria-expanded={expanded}>
          <span>{expanded ? 'Hide reasoning' : 'Why this fits you'}</span>
          <svg
            width="10" height="10" viewBox="0 0 12 12" fill="none"
            style={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 200ms' }}
          >
            <path d="M3 5l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <span style={{ fontSize: 12, color: 'var(--mute)' }}>
          Source: WA ESD wage tables · O*NET task overlap
        </span>
      </div>

      {expanded && (
        <div className="why-body">{pathway.why}</div>
      )}
    </article>
  );
}

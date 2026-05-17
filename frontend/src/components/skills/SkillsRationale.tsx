interface SkillsRationaleProps {
  rationale: string;
  confirmedCount: number;
  totalCount: number;
}

export default function SkillsRationale({ rationale, confirmedCount, totalCount }: SkillsRationaleProps): React.ReactElement {
  return (
    <div className="skills-rationale">
      <div className="icon" aria-hidden="true">
        <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
          <path d="M10 2v3M10 15v3M2 10h3M15 10h3M4.5 4.5l2.1 2.1M13.4 13.4l2.1 2.1M4.5 15.5l2.1-2.1M13.4 6.6l2.1-2.1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <circle cx="10" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      </div>
      <div>
        <div className="eyebrow" style={{ marginBottom: 4 }}>What the AI inferred</div>
        <p style={{ margin: 0, fontSize: 15.5, color: 'var(--ink-2)', lineHeight: 1.55 }}>
          {rationale} <strong style={{ color: 'var(--ink)', fontWeight: 500 }}>Remove any that don't feel like you.</strong> We won't use what you remove.
        </p>
      </div>
    </div>
  );
}

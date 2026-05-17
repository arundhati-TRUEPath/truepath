/* global React, Btn, Tag, Confidence, AIThinking, SectionHead, StepFrame, TPN_DATA */
// Skills (Step 2), Pathways (Step 3), Plan (Step 4)

const { useState: useStateS, useEffect: useEffectS, useMemo: useMemoS } = React;

/* ===================== SKILLS ===================== */
function SkillsPage({ onComplete, onBack }) {
  const allSkills = TPN_DATA.skillsCatalog;
  // 8 of 12 pre-selected by "AI"
  const [confirmed, setConfirmed] = useStateS(() => allSkills.slice(0, 8).map(s => s.id));
  const [loading, setLoading] = useStateS(true);

  useEffectS(() => {
    const t = setTimeout(() => setLoading(false), 1100);
    return () => clearTimeout(t);
  }, []);

  function toggle(id) {
    setConfirmed(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  if (loading) {
    return (
      <main className="page page-narrow step-frame" style={{ textAlign: 'center', paddingTop: 120 }}>
        <AIThinking label="Reading your intake answers…" />
        <h2 className="display" style={{ marginTop: 24, fontSize: 36 }}>
          Pulling together the skills we see in you.
        </h2>
        <p className="lede" style={{ margin: '12px auto 0' }}>
          We’re cross-referencing your answers against O*NET task data.
        </p>
        <div className="skeleton-grid" style={{
          display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginTop: 40, maxWidth: 680, marginInline: 'auto'
        }}>
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} style={{
              height: 56, borderRadius: 14, background: 'var(--card-tint)',
              border: '1px solid var(--line)', opacity: 0.6 + (i % 3) * 0.1,
              animation: `pulse 1.6s ease-in-out ${i * 0.1}s infinite`
            }} />
          ))}
        </div>
        <style>{`@keyframes pulse{50%{opacity:.3}}`}</style>
      </main>
    );
  }

  return (
    <main className="page step-frame">
      <SectionHead
        eyebrow="Step 2 · Skills"
        title="Here’s what we see in you."
        right={(
          <span>
            <em style={{ color: 'var(--ink)', fontStyle: 'normal', fontFamily: 'var(--font-display)' }}>{confirmed.length}</em>
            {' / '}{allSkills.length} skills confirmed
          </span>
        )}
      />

      <div className="skills-rationale">
        <div className="icon" aria-hidden>
          <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
            <path d="M10 2v3M10 15v3M2 10h3M15 10h3M4.5 4.5l2.1 2.1M13.4 13.4l2.1 2.1M4.5 15.5l2.1-2.1M13.4 6.6l2.1-2.1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            <circle cx="10" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.5"/>
          </svg>
        </div>
        <div>
          <div className="eyebrow" style={{ marginBottom: 4 }}>What the AI inferred</div>
          <p style={{ margin: 0, fontSize: 15.5, color: 'var(--ink-2)', lineHeight: 1.55 }}>
            From your caregiving background, weekday-evening availability, and stated preference
            for hands-on work, we pre-selected the skills below. <strong style={{ color: 'var(--ink)', fontWeight: 500 }}>
            Remove any that don’t feel like you.</strong> We won’t use what you remove.
          </p>
        </div>
      </div>

      <div className="skills-grid">
        {allSkills.map(s => {
          const on = confirmed.includes(s.id);
          return (
            <button
              key={s.id}
              type="button"
              className="skill-chip"
              data-on={on}
              onClick={() => toggle(s.id)}
              aria-pressed={on ? 'true' : 'false'}
            >
              <span className="check" aria-hidden>
                <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                  <path d="M2.5 6.2l2.4 2.4 4.6-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </span>
              <div className="label">{s.label}</div>
              <div className="sub">{s.sub}</div>
            </button>
          );
        })}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 32, gap: 12, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 13, color: 'var(--mute)' }}>
          Skills are how the system finds your fit — less is fine, but at least 3 is recommended.
        </span>
        <div style={{ display: 'flex', gap: 10 }}>
          <Btn variant="secondary" onClick={onBack}>
            <span>Back to intake</span>
          </Btn>
          <Btn variant="accent" onClick={() => onComplete(confirmed)} disabled={confirmed.length < 3}>
            Show me pathways
          </Btn>
        </div>
      </div>
    </main>
  );
}

/* ===================== PATHWAYS ===================== */
function PathwaysPage({ onComplete, onBack }) {
  const { pathways, limitations } = TPN_DATA;
  const [loading, setLoading] = useStateS(true);
  const [expanded, setExpanded] = useStateS({});

  useEffectS(() => {
    const t = setTimeout(() => setLoading(false), 1300);
    return () => clearTimeout(t);
  }, []);

  if (loading) {
    return (
      <main className="page step-frame" style={{ textAlign: 'center', paddingTop: 120 }}>
        <AIThinking label="Ranking three pathways for you…" />
        <h2 className="display" style={{ marginTop: 24, fontSize: 36 }}>
          Matching your skills against verified WA workforce data.
        </h2>
      </main>
    );
  }

  return (
    <main className="page step-frame">
      <SectionHead
        eyebrow="Step 3 · Career map"
        title="Three pathways that fit."
        right={(
          <span>Ranked by fit · <em style={{ fontStyle: 'normal', color: 'var(--ink)' }}>King County, May 2026</em></span>
        )}
      />

      <div className="limitations" role="region" aria-label="Honest limits to plan around">
        <div className="icon" aria-hidden>
          <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
            <path d="M10 2L1.5 17h17L10 2z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
            <path d="M10 8v4M10 14.5h.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
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

      <div style={{ display: 'flex', flexDirection: 'column', gap: 18, marginTop: 28 }}>
        {pathways.map(p => (
          <PathwayCard
            key={p.id}
            pathway={p}
            expanded={!!expanded[p.id]}
            onToggle={() => setExpanded(prev => ({ ...prev, [p.id]: !prev[p.id] }))}
          />
        ))}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 36, gap: 12, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 13, color: 'var(--mute)' }}>
          All three pathways are valid. The plan you build next focuses on Pathway 1 with the others as alternates.
        </span>
        <div style={{ display: 'flex', gap: 10 }}>
          <Btn variant="secondary" onClick={onBack}>Back to skills</Btn>
          <Btn variant="accent" onClick={onComplete}>Build my plan</Btn>
        </div>
      </div>
    </main>
  );
}

function PathwayCard({ pathway, expanded, onToggle }) {
  return (
    <article className={`pathway ${pathway.featured ? 'featured' : ''}`}>
      <div className="pathway-rank">{String(pathway.rank).padStart(2, '0')}</div>

      <div className="pathway-head">
        <div>
          <h3 className="pathway-title">{pathway.title}</h3>
          <div className="pathway-sub">{pathway.sub}</div>
          <div style={{ marginTop: 12 }}>
            <Confidence score={pathway.confidence} />
          </div>
        </div>
        <div className="pathway-wage">
          <div className="val">{pathway.wageRange}</div>
          <div className="unit">{pathway.wageNote}</div>
        </div>
      </div>

      <div className="ladder" style={{ '--cols': pathway.ladder.length }}>
        {pathway.ladder.map((step, i) => (
          <React.Fragment key={i}>
            <div className={`ladder-step ${step.current ? 'current' : ''}`}>
              <div className="role">{step.role}</div>
              <div className="meta">{step.meta}</div>
            </div>
            {i < pathway.ladder.length - 1 && (
              <div className="ladder-arrow" aria-hidden>
                <svg width="20" height="12" viewBox="0 0 20 12" fill="none">
                  <path d="M1 6h17M13 1l5 5-5 5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
            )}
          </React.Fragment>
        ))}
      </div>

      <div className="pathway-tags">
        {pathway.tags.map((t, i) => <Tag key={i} tone={t.tone}>{t.label}</Tag>)}
      </div>

      <div className="pathway-foot">
        <button className="why-toggle" onClick={onToggle} aria-expanded={expanded}>
          <span>{expanded ? 'Hide reasoning' : 'Why this fits you'}</span>
          <svg width="10" height="10" viewBox="0 0 12 12" fill="none" style={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 200ms' }}>
            <path d="M3 5l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
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

/* ===================== PLAN ===================== */
function PlanPage({ onRestart, onBack }) {
  const [loading, setLoading] = useStateS(true);
  useEffectS(() => {
    const t = setTimeout(() => setLoading(false), 1500);
    return () => clearTimeout(t);
  }, []);

  if (loading) {
    return (
      <main className="page page-narrow step-frame" style={{ textAlign: 'center', paddingTop: 120 }}>
        <AIThinking label="Building your personalized career plan…" />
        <h2 className="display" style={{ marginTop: 24, fontSize: 36 }}>
          Writing your action plan.
        </h2>
        <p className="lede" style={{ margin: '12px auto 0' }}>
          One page, three next steps, and a list of resources to take with you.
        </p>
      </main>
    );
  }

  const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  return (
    <main className="page step-frame">
      <SectionHead
        eyebrow="Step 4 · Plan"
        title="Your action plan is ready."
        right={<span>Generated {today}</span>}
      />

      <div className="plan-doc" role="region" aria-label="Action plan preview">
        <div className="plan-letterhead">
          <span className="plan-mark" aria-hidden><PathLogo /></span>
          <div>
            <div className="plan-letterhead-name">TRUE Path Navigator</div>
            <div className="plan-letterhead-tag"><em>Clear pathways. Better careers.</em></div>
          </div>
          <span className="plan-letterhead-meta">Personalized career plan · v1</span>
        </div>
        <h2>From caregiving experience to RN — your path.</h2>

        <div className="plan-section">
          <h3>Your background</h3>
          <p>
            You’re returning to work, available weekday evenings and weekends, and you’ve done
            both paid and informal caregiving. You’re optimizing for steady income, predictable
            scheduling, and room to grow.
          </p>
        </div>

        <div className="plan-section">
          <h3>Recommended pathway</h3>
          <p style={{ fontFamily: 'var(--font-display)', fontSize: 22, color: 'var(--ink)' }}>
            CNA → LPN → RN
          </p>
          <p>
            A stackable nursing pathway. Begin as a CNA in 6–12 weeks; bridge into LPN within
            12–18 months; complete an ADN program in 2–3 years total. Wage range across the
            ladder: $22–$52 / hr in King County.
          </p>
        </div>

        <div className="plan-section">
          <h3>Your next three steps</h3>
          <ol className="plan-steps">
            <li>
              <span className="n">1</span>
              <div>
                <strong>Confirm WIOA eligibility with a CPS case manager.</strong>
                <span>Most short-term CNA training in King County is fundable through WIOA. Bring a photo ID and proof of income.</span>
              </div>
            </li>
            <li>
              <span className="n">2</span>
              <div>
                <strong>Apply to an evening CNA cohort at Renton Technical College or Bates Tech.</strong>
                <span>Both run rolling 6–12 week cohorts. Cost is typically waived with WIOA.</span>
              </div>
            </li>
            <li>
              <span className="n">3</span>
              <div>
                <strong>Schedule a one-hour planning call with CPS in week 4 of training.</strong>
                <span>By then you’ll know if the LPN bridge fits your timeline — we’ll line up clinical placements.</span>
              </div>
            </li>
          </ol>
        </div>

        <div className="plan-section">
          <h3>Support resources</h3>
          <p>
            <strong style={{ color: 'var(--ink)', fontWeight: 500 }}>Career Path Services — King County branch.</strong>
            <br />
            Eve Asbury, Workforce Navigator · (206) 555-0142 · eve.asbury@cps.org
            <br />
            Drop-in hours: Tuesdays 1–4pm, 800 5th Ave, Seattle.
          </p>
        </div>

        <div className="plan-foot">
          <strong>Sources:</strong> O*NET task data v28.1 · WA Employment Security Department wage tables (Q1 2026) · ETPL (informational only).
          <br />
          <strong>Disclaimer:</strong> Eligibility for WIOA, training programs, and licensure must be confirmed with a case manager. This plan is generated by AI and is not legal or financial advice.
        </div>
      </div>

      <div className="plan-actions">
        <Btn variant="accent" onClick={() => alert('PDF would download in production.')}>
          <span>Download PDF</span>
        </Btn>
        <Btn variant="secondary" onClick={() => window.print()} arrow={false}>
          <span>Print</span>
        </Btn>
        <Btn variant="secondary" onClick={() => alert('Email link would be sent in production.')} arrow={false}>
          <span>Email to me</span>
        </Btn>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 40, gap: 12, flexWrap: 'wrap' }}>
        <Btn variant="secondary" onClick={onBack} arrow={false}>Back to pathways</Btn>
        <button onClick={onRestart} style={{
          background: 'transparent', border: 0, color: 'var(--mute)', cursor: 'pointer',
          fontSize: 13, textDecoration: 'underline', textUnderlineOffset: 4, textDecorationColor: 'var(--line-strong)'
        }}>
          Start a new session
        </button>
      </div>
    </main>
  );
}

Object.assign(window, { SkillsPage, PathwaysPage, PlanPage });

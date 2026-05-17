/* global React, PillButton, Btn, Tag, Confidence, AIThinking, SectionHead, StepFrame, TPN_DATA */
// Landing screen + Intake (Step 1) — single-page scroll, mobile-friendly

const { useState: useStateI, useEffect: useEffectI, useMemo: useMemoI, useRef: useRefI } = React;

/* ===================== LANDING ===================== */
function Landing({ onBegin }) {
  return (
    <main className="step-frame">
      <section className="hero">
        <div>
          <div className="hero-eyebrow">
            <span className="pip">{'\u2713'}</span>
            <span>Grounded in verified Washington State workforce data</span>
          </div>
          <h1>
            From where you are <em>—</em><br/>
            to a healthcare <em>career</em>.
          </h1>
          <div className="hero-tagline"><em>Clear pathways. Better careers.</em></div>
          <p className="lede">
            A few honest questions, a personalized read of your strengths, and three
            real pathways into King County’s healthcare workforce. About five minutes.
            No sign-in. No resume.
          </p>
          <div className="hero-cta">
            <Btn variant="accent" onClick={onBegin}>Begin intake</Btn>
            <Btn variant="secondary" onClick={onBegin}>
              <span>See a sample plan</span>
            </Btn>
          </div>
          <div className="hero-meta">
            <div>
              <b>~5 min</b>
              <span>typical intake</span>
            </div>
            <div>
              <b>3</b>
              <span>tailored pathways</span>
            </div>
            <div>
              <b>19,000+</b>
              <span>WA nursing roles needed</span>
            </div>
          </div>
        </div>

        {/* Stacked preview cards */}
        <div className="hero-card-stack" aria-hidden>
          <div className="hcard a">
            <div className="eyebrow" style={{ marginBottom: 8 }}>Question 02 of 9</div>
            <div className="h-title">When can you realistically attend training?</div>
            <div className="h-sub">Pick all that apply.</div>
            <div className="h-row">
              <span className="tag">Weekday daytime</span>
              <span className="tag sage"><span className="dot" />Evenings</span>
              <span className="tag">Weekends</span>
              <span className="tag sage"><span className="dot" />Online</span>
            </div>
          </div>
          <div className="hcard b">
            <div className="eyebrow" style={{ marginBottom: 8 }}>Skills the AI sees in you</div>
            <div className="h-title">Active listening, empathy, time management</div>
            <div className="h-sub">Based on caregiving + service background.</div>
            <div className="h-row">
              <span className="tag amber">8 skills</span>
              <span className="tag">2 you removed</span>
            </div>
          </div>
          <div className="hcard c">
            <div className="eyebrow" style={{ marginBottom: 8 }}>Recommended pathway · #1</div>
            <div className="h-title">CNA → LPN → RN</div>
            <div className="h-sub">$22 – $52 / hr · stackable</div>
            <div className="h-row">
              <span className="tag sage">WIOA eligible</span>
              <span className="tag">Evening classes</span>
              <span className="tag amber">6 wk start</span>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

/* ===================== INTAKE — single-page scroll ===================== */
function IntakePage({ onComplete }) {
  const seed = TPN_DATA.seedQuestions;
  const followups = TPN_DATA.followups;

  // visibleQuestions starts with all seeds. Follow-ups are revealed
  // once the user has answered every seed question.
  const [visible, setVisible] = useStateI(() => seed.map(q => q.id));
  const [answers, setAnswers] = useStateI({}); // { qid: [optId,...] }
  const [thinkingFu, setThinkingFu] = useStateI(false);
  const [submitting, setSubmitting] = useStateI(false);

  // After every seed is answered, reveal followups one by one
  useEffectI(() => {
    const seedAllAnswered = seed.every(q => answers[q.id] && answers[q.id].length > 0);
    if (!seedAllAnswered) return;
    const nextFu = followups.find(f => !visible.includes(f.id));
    if (!nextFu) return;
    setThinkingFu(true);
    const t = setTimeout(() => {
      setVisible(prev => [...prev, nextFu.id]);
      setThinkingFu(false);
      // gentle scroll to newly revealed question
      requestAnimationFrame(() => {
        const el = document.getElementById(`q-${nextFu.id}`);
        if (el) {
          const y = el.getBoundingClientRect().top + window.scrollY - 90;
          window.scrollTo({ top: y, behavior: 'smooth' });
        }
      });
    }, 900 + Math.random() * 500);
    return () => clearTimeout(t);
  }, [answers, visible]);

  const allQuestions = [...seed, ...followups].filter(q => visible.includes(q.id));
  const answeredCount = allQuestions.filter(q => answers[q.id] && answers[q.id].length > 0).length;
  const totalEstimate = seed.length + followups.length;
  const progress = answeredCount / totalEstimate;
  const seedAllAnswered = seed.every(q => answers[q.id] && answers[q.id].length > 0);
  const everythingAnswered = seedAllAnswered;
  const seedRemaining = seed.filter(q => !(answers[q.id] && answers[q.id].length > 0)).length;

  function setAnswer(qId, optId, multi) {
    setAnswers(prev => {
      const cur = prev[qId] || [];
      if (multi) {
        return { ...prev, [qId]: cur.includes(optId) ? cur.filter(x => x !== optId) : [...cur, optId] };
      }
      return { ...prev, [qId]: [optId] };
    });
  }

  function finish() {
    setSubmitting(true);
    setTimeout(() => onComplete(answers), 600);
  }

  return (
    <main className="page page-narrow step-frame">
      <div className="subhead">
        <div className="crumbs">
          <em>Step 1</em> <span>·</span> <span>Intake</span>
        </div>
        <div className="intake-progress">
          <div className="progress" aria-label="Intake progress">
            <i style={{ width: `${Math.max(progress * 100, 4)}%` }} />
          </div>
          <div className="intake-progress-meta">
            <em>{answeredCount}</em> of {totalEstimate} answered
          </div>
        </div>
      </div>

      <div className="intake-intro">
        <h2 className="display">A few honest questions.</h2>
        <p className="lede">
          The first <em>seven</em> are the essentials we need to recommend a real fit — they
          take about three minutes. After that, a couple of optional follow-ups help sharpen
          the result. Tap the choice that fits best; you can change any answer until you continue.
        </p>
      </div>

      <div className="q-stack">
        {allQuestions.map((q, i) => (
          <QuestionBlock
            key={q.id}
            q={q}
            index={i}
            isFollowup={q.id.startsWith('fu_')}
            value={answers[q.id] || []}
            onPick={(optId) => setAnswer(q.id, optId, !!q.multi)}
          />
        ))}

        {thinkingFu && (
          <div className="q-thinking-row">
            <AIThinking label="Looking at your answers for a useful follow-up…" />
          </div>
        )}
      </div>

      <div className="intake-foot">
        <div className="intake-foot-meta">
          {seedAllAnswered
            ? <span>All seven essentials in. Follow-ups are optional — continue whenever you’re ready.</span>
            : <span>{seedRemaining} essential question{seedRemaining === 1 ? '' : 's'} left to unlock your skills.</span>}
        </div>
        <Btn
          variant="accent"
          onClick={finish}
          disabled={!everythingAnswered || submitting}
        >
          {submitting ? 'Reading your answers…' : 'See my skills'}
        </Btn>
      </div>

      <div className="intake-fineprint">
        Your answers stay on this device. No account is created.
      </div>
    </main>
  );
}

function QuestionBlock({ q, index, isFollowup, value, onPick }) {
  const answered = value.length > 0;
  return (
    <section
      id={`q-${q.id}`}
      className={`q-block ${answered ? 'is-answered' : ''} ${isFollowup ? 'is-followup' : ''}`}
    >
      <header className="q-block-head">
        <div className="q-block-num">
          {isFollowup ? <em>AI follow-up</em> : <>Question <em>{String(index + 1).padStart(2, '0')}</em></>}
        </div>
        {!isFollowup && <Tag tone="sage">Required</Tag>}
        {isFollowup && <Tag tone="">Optional</Tag>}
        {q.multi && <Tag tone="">Choose any</Tag>}
        {answered && !q.multi && (
          <span className="q-answered-mark" aria-hidden>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M2.5 6.2l2.4 2.4 4.6-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </span>
        )}
      </header>

      {isFollowup && q.rationale && (
        <div className="followup-banner">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5"/>
            <path d="M8 4.5v4M8 11h.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          <span>{q.rationale}</span>
        </div>
      )}

      <h3 className="q-block-title">{q.title}</h3>
      {q.hint && <p className="q-block-hint">{q.hint}</p>}

      <div className={`q-options ${q.layout === 'column' ? 'column' : ''}`}>
        {q.options.map((opt, i) => (
          <PillButton
            key={opt.id}
            pressed={value.includes(opt.id)}
            onClick={() => onPick(opt.id)}
          >
            {opt.label}
          </PillButton>
        ))}
      </div>
    </section>
  );
}

Object.assign(window, { Landing, IntakePage });

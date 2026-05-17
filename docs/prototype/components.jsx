/* global React */
// Shared visual components for TRUE Path Navigator

const { useState, useEffect, useRef } = React;

/* ----------- Brand mark + wordmark -----------
   "Sun-over-bowl" mark: a deep navy panel with a terracotta circle
   floating above a wide cream smile-curve, three small dots and a
   thin horizontal line tucked beneath. */
function PathLogo({ size }) {
  const style = size ? { width: size, height: size } : { width: '100%', height: '100%' };
  return (
    <svg viewBox="0 0 48 48" style={style} fill="none" aria-hidden>
      <rect width="48" height="48" rx="8" fill="#0E2226" />
      <circle cx="24" cy="11" r="4.8" fill="#CE6A49" />
      <path
        d="M9 33 A 15 14 0 0 0 39 33"
        stroke="#F5F0EB"
        strokeWidth="2.6"
        strokeLinecap="round"
        fill="none"
      />
      <circle cx="19.5" cy="39" r="1.3" fill="#F5F0EB" />
      <circle cx="24" cy="39" r="1.3" fill="#F5F0EB" />
      <circle cx="28.5" cy="39" r="1.3" fill="#F5F0EB" />
      <line
        x1="13" y1="43.5" x2="35" y2="43.5"
        stroke="#F5F0EB"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </svg>
  );
}

function BrandMark({ onClick }) {
  return (
    <div className="brand" onClick={onClick} role="button" tabIndex={0}>
      <div className="brand-mark"><img src="assets/logo.png" alt="TRUE Path Navigator" /></div>
      <div>
        <div className="brand-name">TRUE Path Navigator</div>
        <div className="brand-sub"><em>Clear pathways. Better careers.</em></div>
      </div>
    </div>
  );
}

/* ----------- Top bar with 4-step indicator ----------- */
const STEPS = [
  { id: 'intake',   label: 'Intake' },
  { id: 'skills',   label: 'Skills' },
  { id: 'pathways', label: 'Pathways' },
  { id: 'plan',     label: 'Plan' },
];

function Stepper({ current }) {
  const idx = STEPS.findIndex(s => s.id === current);
  return (
    <div className="stepper" aria-label="Progress through the four steps">
      {STEPS.map((s, i) => {
        const state = i < idx ? 'done' : i === idx ? 'active' : 'todo';
        return (
          <React.Fragment key={s.id}>
            <div className={`step ${state}`}>
              <span className="num">{i < idx ? '\u2713' : i + 1}</span>
              <span>{s.label}</span>
            </div>
            {i < STEPS.length - 1 && <div className={`sep ${i < idx ? 'done' : ''}`} />}
          </React.Fragment>
        );
      })}
    </div>
  );
}

function TopBar({ route, onHome, sessionId }) {
  const showStepper = route !== 'landing';
  return (
    <header className="topbar">
      <BrandMark onClick={onHome} />
      <div className="topbar-meta">
        {showStepper ? <Stepper current={route} /> : null}
        {!showStepper && (
          <span><span className="dot" />Session ready · no sign-in needed</span>
        )}
      </div>
    </header>
  );
}

/* ----------- Buttons ----------- */
function Btn({ children, onClick, variant, disabled, type, arrow }) {
  return (
    <button
      type={type || 'button'}
      className={`btn ${variant || ''}`}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
      {arrow !== false && (
        <svg className="btn-arrow" viewBox="0 0 16 16" fill="none" aria-hidden>
          <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      )}
    </button>
  );
}

/* ----------- Pill button (the primary interaction unit) ----------- */
function PillButton({ children, pressed, onClick, letter, compact, ghost }) {
  return (
    <button
      type="button"
      className={`pill ${compact ? 'compact' : ''} ${ghost ? 'ghost' : ''}`}
      aria-pressed={pressed ? 'true' : 'false'}
      onClick={onClick}
    >
      {letter && <span className="lead-letter">{letter}</span>}
      <span>{children}</span>
    </button>
  );
}

/* ----------- Tag ----------- */
function Tag({ children, tone }) {
  return (
    <span className={`tag ${tone || ''}`}>
      <span className="dot" />
      {children}
    </span>
  );
}

/* ----------- Confidence bars ----------- */
function Confidence({ score }) {
  // score 1..5
  return (
    <span className="confidence" title={`Fit confidence ${score}/5`}>
      <span className="bars" aria-hidden>
        {[1,2,3,4,5].map(n => <i key={n} className={n <= score ? 'on' : ''} />)}
      </span>
      <span>Fit confidence</span>
    </span>
  );
}

/* ----------- AI thinking pulse ----------- */
function AIThinking({ label }) {
  return (
    <span className="ai-thinking" aria-live="polite">
      <span className="pulse" />
      {label || 'Looking at what you said…'}
    </span>
  );
}

/* ----------- Section head ----------- */
function SectionHead({ eyebrow, title, right }) {
  return (
    <div className="section-head">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h2 className="display" style={{ marginTop: 6 }}>{title}</h2>
      </div>
      {right && <div className="right">{right}</div>}
    </div>
  );
}

/* ----------- Animated step frame ----------- */
function StepFrame({ keyId, children }) {
  // remount on keyId change to retrigger entrance animation
  return <div className="step-frame" key={keyId}>{children}</div>;
}

/* expose for other babel scripts */
Object.assign(window, {
  BrandMark, PathLogo, Stepper, TopBar, Btn, PillButton, Tag, Confidence,
  AIThinking, SectionHead, StepFrame, STEPS
});

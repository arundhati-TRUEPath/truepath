import Link from 'next/link';
import TopBar from '@/components/shared/TopBar';

function PathLogo({ size = 26 }: { size?: number }) {
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} fill="none" aria-hidden="true">
      <rect width="48" height="48" rx="8" fill="#0E2226" />
      <circle cx="24" cy="11" r="4.8" fill="#CE6A49" />
      <path d="M9 33 A 15 14 0 0 0 39 33" stroke="#F5F0EB" strokeWidth="2.6" strokeLinecap="round" fill="none" />
      <circle cx="19.5" cy="39" r="1.3" fill="#F5F0EB" />
      <circle cx="24" cy="39" r="1.3" fill="#F5F0EB" />
      <circle cx="28.5" cy="39" r="1.3" fill="#F5F0EB" />
      <line x1="13" y1="43.5" x2="35" y2="43.5" stroke="#F5F0EB" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

export default function LandingPage(): React.ReactElement {
  return (
    <div className="app-shell">
      <TopBar />

      <main className="step-frame">
        <section className="hero">
          <div>
            <div className="hero-eyebrow">
              <span className="pip">✓</span>
              <span>Grounded in verified Washington State workforce data</span>
            </div>
            <h1>
              From where you are <em>—</em>
              <br />
              to a healthcare <em>career</em>.
            </h1>
            <div className="hero-tagline"><em>Clear pathways. Better careers.</em></div>
            <p className="lede">
              A few honest questions, a personalized read of your strengths, and three
              real pathways into King County's healthcare workforce. About five minutes.
              No sign-in. No resume.
            </p>
            <div className="hero-cta">
              <Link href="/intake" className="btn accent">
                Begin intake
                <svg className="btn-arrow" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Link>
              <Link href="/intake" className="btn secondary">
                <span>See a sample plan</span>
                <svg className="btn-arrow" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Link>
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

          <div className="hero-card-stack" aria-hidden="true">
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
                <span className="tag amber"><span className="dot" />8 skills</span>
                <span className="tag">2 you removed</span>
              </div>
            </div>
            <div className="hcard c">
              <div className="eyebrow" style={{ marginBottom: 8 }}>Recommended pathway · #1</div>
              <div className="h-title">CNA → LPN → RN</div>
              <div className="h-sub">$22 – $52 / hr · stackable</div>
              <div className="h-row">
                <span className="tag sage"><span className="dot" />WIOA eligible</span>
                <span className="tag">Evening classes</span>
                <span className="tag amber"><span className="dot" />6 wk start</span>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="app-foot">
        <div className="app-foot-brand">
          <span className="app-foot-mark" aria-hidden="true"><PathLogo /></span>
          <span><strong>TRUE Path Navigator</strong> <em>· Clear pathways. Better careers.</em></span>
        </div>
        <span>© 2026 Career Path Services · King County, WA · MVP</span>
      </footer>
    </div>
  );
}

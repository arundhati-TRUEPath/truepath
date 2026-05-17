/* global React, ReactDOM, TopBar, Landing, IntakePage, SkillsPage, PathwaysPage, PlanPage, useTweaks, TweaksPanel, TweakSection, TweakColor, TweakRadio, TweakToggle */

const { useState, useEffect, useCallback } = React;

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "accent": "#CE6A49",
  "accentDeep": "#B94A3E",
  "accentSoft": "#F0DCCA",
  "paper": "#F5F0EB",
  "paperDeep": "#EDE3D4",
  "serif": "Instrument Serif"
}/*EDITMODE-END*/;

const ACCENT_PALETTES = [
  ['#CE6A49', '#B94A3E', '#F0DCCA'], // soft terracotta (default)
  ['#4F6E62', '#3B5347', '#E2E7E0'], // sage
  ['#5F6E8C', '#414F6A', '#E3E6EC'], // dusk blue
  ['#8A6A4F', '#5F4630', '#EFE5D5'], // warm clay
  ['#7A6E8F', '#534866', '#E8E3EE'], // mauve
];

const PAPERS = [
  ['#F5F0EB', '#EDE3D4'], // terracotta paper (default)
  ['#F4F1EA', '#EFEBE2'], // cream
  ['#F2F1ED', '#EDEBE5'], // bone
  ['#F2F4F1', '#EAEEE8'], // pale pistachio
  ['#F2F1F0', '#EBEAE8'], // neutral
];

const SERIFS = [
  { value: 'Instrument Serif', label: 'Instrument Serif' },
  { value: 'Newsreader', label: 'Newsreader' },
  { value: 'EB Garamond', label: 'EB Garamond' },
];

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [route, setRoute] = useState('landing');

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--sage',      t.accent);
    root.style.setProperty('--sage-deep', t.accentDeep);
    root.style.setProperty('--sage-soft', t.accentSoft);
    root.style.setProperty('--paper',     t.paper);
    root.style.setProperty('--paper-2',   t.paperDeep);
    root.style.setProperty('--font-display', `'${t.serif}', Georgia, serif`);
  }, [t.accent, t.accentDeep, t.accentSoft, t.paper, t.paperDeep, t.serif]);

  const go = useCallback((r) => {
    setRoute(r);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  return (
    <div className="app-shell">
      <TopBar route={route} onHome={() => go('landing')} />

      {route === 'landing'  && <Landing onBegin={() => go('intake')} />}
      {route === 'intake'   && <IntakePage onComplete={() => go('skills')} />}
      {route === 'skills'   && <SkillsPage onComplete={() => go('pathways')} onBack={() => go('intake')} />}
      {route === 'pathways' && <PathwaysPage onComplete={() => go('plan')} onBack={() => go('skills')} />}
      {route === 'plan'     && <PlanPage onRestart={() => go('landing')} onBack={() => go('pathways')} />}

      <footer className="app-foot">
        <div className="app-foot-brand">
          <span className="app-foot-mark" aria-hidden><PathLogo /></span>
          <span><strong>TRUE Path Navigator</strong> <em>· Clear pathways. Better careers.</em></span>
        </div>
        <span>© 2026 Career Path Services · King County, WA · MVP prototype</span>
      </footer>

      <TweaksPanel title="Tweaks">
        <TweakSection label="Accent palette">
          <TweakColor
            value={[t.accent, t.accentDeep, t.accentSoft]}
            options={ACCENT_PALETTES}
            onChange={(palette) => setTweak({
              accent: palette[0],
              accentDeep: palette[1],
              accentSoft: palette[2],
            })}
          />
        </TweakSection>

        <TweakSection label="Paper tone">
          <TweakColor
            value={[t.paper, t.paperDeep]}
            options={PAPERS}
            onChange={(palette) => setTweak({ paper: palette[0], paperDeep: palette[1] })}
          />
        </TweakSection>

        <TweakSection label="Display typeface">
          <TweakRadio
            label="Display typeface"
            value={t.serif}
            options={SERIFS}
            onChange={(v) => setTweak('serif', v)}
          />
        </TweakSection>
      </TweaksPanel>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);

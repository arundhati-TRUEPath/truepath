'use client';

import { usePathname } from 'next/navigation';
import TopBar from '@/components/shared/TopBar';

type WizardStep = 'intake' | 'skills' | 'pathways' | 'plan';

function pathnameToStep(path: string): WizardStep | undefined {
  if (path.includes('/intake'))   return 'intake';
  if (path.includes('/skills'))   return 'skills';
  if (path.includes('/pathways')) return 'pathways';
  if (path.includes('/plan'))     return 'plan';
  return undefined;
}

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

export default function WizardLayout({ children }: { children: React.ReactNode }): React.ReactElement {
  const pathname = usePathname();
  const currentStep = pathnameToStep(pathname);

  return (
    <div className="app-shell">
      <TopBar currentStep={currentStep} />
      {children}
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

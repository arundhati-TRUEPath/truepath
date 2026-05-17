'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSessionStore } from '@/lib/store/session';
import type { Pathway, Limitations } from '@/lib/types/pathways';

const PATHWAYS: Pathway[] = [
  {
    id: 'cna-rn', rank: 1, featured: true,
    title: 'CNA → LPN → RN',
    sub: 'Stackable nursing pathway. Start in 6–12 weeks, advance over 2–4 years.',
    wageRange: '$22 – $52 / hr', wageNote: 'King County, May 2026',
    confidence: 4,
    tags: [
      { label: 'WIOA eligible', tone: 'sage' },
      { label: 'Evening classes', tone: '' },
      { label: 'Short start (6 wks)', tone: 'amber' },
      { label: 'High demand', tone: 'sage' },
    ],
    ladder: [
      { role: 'CNA', meta: '6–12 weeks · Entry', current: true },
      { role: 'LPN', meta: '12–18 months' },
      { role: 'RN (ADN)', meta: '2–3 years' },
    ],
    why: 'You can start earning as a CNA inside three months while your caregiving experience is recognized. Evening LPN bridge programs at Renton Technical College and Bates Tech let you stack credentials without leaving your job. Statewide nursing shortage means hiring momentum is strong.',
  },
  {
    id: 'ma-clinical', rank: 2,
    title: 'Medical Assistant → Specialty MA',
    sub: 'Clinic-based role with predictable hours, no nights. Stackable into specialty work.',
    wageRange: '$24 – $34 / hr', wageNote: 'King County, May 2026',
    confidence: 3,
    tags: [
      { label: 'Daytime hours', tone: 'sage' },
      { label: 'Hybrid program', tone: '' },
      { label: 'WIOA eligible', tone: 'sage' },
      { label: '9–12 month training', tone: '' },
    ],
    ladder: [
      { role: 'MA (certified)', meta: '9–12 months · Entry', current: true },
      { role: 'Specialty MA', meta: '+6 months' },
      { role: 'Clinical lead', meta: '2–4 years' },
    ],
    why: 'Your scheduling preference for weekday daytime and your administrative comfort make a clinic-based MA role a clean fit. Highline College and Pima Medical Institute both run hybrid cohorts with rolling starts. Specialty MA (cardiology, derm) lifts pay meaningfully without further degree.',
  },
  {
    id: 'phleb', rank: 3,
    title: 'Phlebotomy / Patient Care Tech',
    sub: 'Fastest entry. Strong fit if you want to be in healthcare in under 8 weeks.',
    wageRange: '$21 – $28 / hr', wageNote: 'King County, May 2026',
    confidence: 3,
    tags: [
      { label: 'Fastest start', tone: 'amber' },
      { label: '4–8 wk training', tone: '' },
      { label: 'Hospital + lab', tone: '' },
    ],
    ladder: [
      { role: 'Phlebotomist', meta: '4–8 weeks · Entry', current: true },
      { role: 'PCT', meta: '+8–12 weeks' },
      { role: 'Lab tech (AAS)', meta: '2 years' },
    ],
    why: 'If "soon" matters most, this is the shortest path to a real healthcare badge. Less direct patient time than nursing, more procedural focus. A good bridge if you want to test the environment before committing to a longer program.',
  },
];

const LIMITATIONS: Limitations = {
  headline: 'A few honest limits to plan around',
  summary: "Based on your answers, here's what to keep in mind. None of these block the pathways below — they shape the order and timing.",
  bullets: [
    'Daytime-only programs may not fit if you keep a current job; evening LPN options are flagged on Pathway 1.',
    'Funding eligibility (WIOA) must be confirmed with a case manager — we cannot verify it inside this tool.',
    'Internationally earned credentials may need evaluation through CGFNS before nursing licensure.',
    'Wages shown are King County averages. Rural-WA wages run 8–12% lower for the same roles.',
  ],
};

interface PathwaysFlowState {
  isLoading: boolean;
  pathways: Pathway[];
  limitations: Limitations;
  expandedIds: Record<string, boolean>;
  toggleExpanded: (id: string) => void;
  confirm: () => void;
  goBack: () => void;
}

export function usePathwaysFlow(): PathwaysFlowState {
  const router = useRouter();
  const { setSelectedPathway } = useSessionStore();
  const [isLoading, setIsLoading] = useState(true);
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const t = setTimeout(() => setIsLoading(false), 1300);
    return () => clearTimeout(t);
  }, []);

  function toggleExpanded(id: string): void {
    setExpandedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function confirm(): void {
    setSelectedPathway(PATHWAYS[0].id);
    router.push('/plan');
  }

  function goBack(): void {
    router.push('/skills');
  }

  return { isLoading, pathways: PATHWAYS, limitations: LIMITATIONS, expandedIds, toggleExpanded, confirm, goBack };
}

'use client';

import type { Pathway, Limitations } from '@/lib/types/pathways';

interface PathwaysState {
  pathways: Pathway[];
  limitations: Limitations | null;
  isLoading: boolean;
}

export function usePathways(): PathwaysState {
  throw new Error('not implemented');
}

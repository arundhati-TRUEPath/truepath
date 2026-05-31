'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { recommendPathways, pathwaysPdfUrl } from '@/lib/api/endpoints';
import { useSessionStore } from '@/lib/store/session';
import type { Pathway, Limitations } from '@/lib/types/pathways';
import type { AppError } from '@/lib/api/client';

const EMPTY_LIMITATIONS: Limitations = { headline: '', summary: '', bullets: [] };

interface PathwaysFlowState {
  isLoading: boolean;
  pathways: Pathway[];
  limitations: Limitations;
  expandedIds: Record<string, boolean>;
  error: AppError | null;
  pdfUrl: string;
  toggleExpanded: (id: string) => void;
  confirm: () => void;
  goBack: () => void;
  downloadPdf: () => void;
}

export function usePathwaysFlow(): PathwaysFlowState {
  const router = useRouter();
  const { sessionId, setPathways, setSelectedPathway } = useSessionStore();
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});

  const pathwaysQuery = useQuery({
    queryKey: ['pathways', sessionId],
    queryFn: () => recommendPathways(sessionId),
    enabled: !!sessionId,
    staleTime: Infinity,
    retry: (count, err) => count < 1 && (err as AppError).retryable === true,
  });

  useEffect(() => {
    if (!pathwaysQuery.data) return;
    setPathways(pathwaysQuery.data.pathways, pathwaysQuery.data.limitations);
  }, [pathwaysQuery.data, setPathways]);

  function toggleExpanded(id: string): void {
    setExpandedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function confirm(): void {
    const first = pathwaysQuery.data?.pathways[0];
    if (first) setSelectedPathway(first.id);
    router.push('/plan');
  }

  function goBack(): void {
    router.push('/skills');
  }

  function downloadPdf(): void {
    if (!sessionId) return;
    window.open(pathwaysPdfUrl(sessionId), '_blank', 'noopener,noreferrer');
  }

  return {
    isLoading: pathwaysQuery.isPending,
    pathways: pathwaysQuery.data?.pathways ?? [],
    limitations: pathwaysQuery.data?.limitations ?? EMPTY_LIMITATIONS,
    expandedIds,
    error: pathwaysQuery.error as AppError | null,
    pdfUrl: sessionId ? pathwaysPdfUrl(sessionId) : '',
    toggleExpanded,
    confirm,
    goBack,
    downloadPdf,
  };
}

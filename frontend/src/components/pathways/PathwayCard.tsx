'use client';

import type { Pathway } from '@/lib/types/pathways';

interface PathwayCardProps {
  pathway: Pathway;
  expanded: boolean;
  onToggle: () => void;
}

export default function PathwayCard({ pathway, expanded, onToggle }: PathwayCardProps) {
  return null;
}

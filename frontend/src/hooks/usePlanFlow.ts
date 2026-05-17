'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface PlanFlowState {
  isLoading: boolean;
  generatedDate: string;
  goBack: () => void;
  restart: () => void;
  downloadPdf: () => void;
  emailPlan: () => void;
}

export function usePlanFlow(): PlanFlowState {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setIsLoading(false), 1500);
    return () => clearTimeout(t);
  }, []);

  const generatedDate = new Date().toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
  });

  function goBack(): void {
    router.push('/pathways');
  }

  function restart(): void {
    router.push('/');
  }

  function downloadPdf(): void {
    alert('PDF download coming in a future release.');
  }

  function emailPlan(): void {
    alert('Email option coming in a future release.');
  }

  return { isLoading, generatedDate, goBack, restart, downloadPdf, emailPlan };
}

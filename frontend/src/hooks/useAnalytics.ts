'use client';

interface AnalyticsHook {
  track: (event: string, payload?: Record<string, unknown>) => void;
}

export function useAnalytics(): AnalyticsHook {
  const track = (event: string, payload?: Record<string, unknown>) => {
    if (process.env.NEXT_PUBLIC_ANALYTICS_ENABLED !== 'true') return;
    void import('@/lib/api/endpoints').then(({ logEvent }) => logEvent(event, payload ?? {}));
  };

  return { track };
}

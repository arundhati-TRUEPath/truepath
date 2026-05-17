interface LoadingStateProps {
  label?: string;
  skeletonRows?: number;
}

export default function LoadingState({ label = 'Loading…', skeletonRows = 4 }: LoadingStateProps): React.ReactElement {
  return (
    <div aria-busy="true" aria-label={label} className="animate-pulse space-y-3 w-full">
      {Array.from({ length: skeletonRows }).map((_, i) => (
        <div
          key={i}
          className="h-10 rounded-full bg-[var(--paper-2)]"
          style={{ width: `${75 + (i % 3) * 10}%` }}
        />
      ))}
    </div>
  );
}

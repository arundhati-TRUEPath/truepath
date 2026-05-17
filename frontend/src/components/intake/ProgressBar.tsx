interface ProgressBarProps {
  answered: number;
  total: number;
}

export default function ProgressBar({ answered, total }: ProgressBarProps): React.ReactElement {
  const pct = total > 0 ? Math.max((answered / total) * 100, 4) : 4;
  return (
    <div className="intake-progress">
      <div
        className="progress"
        role="progressbar"
        aria-valuenow={answered}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-label="Intake progress"
      >
        <i style={{ width: `${pct}%` }} />
      </div>
      <div className="intake-progress-meta">
        <em>{answered}</em> of {total} answered
      </div>
    </div>
  );
}

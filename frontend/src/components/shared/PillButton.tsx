'use client';

interface PillButtonProps {
  children: React.ReactNode;
  pressed?: boolean;
  onClick?: () => void;
  compact?: boolean;
  disabled?: boolean;
  letter?: string;
  columnLayout?: boolean;
}

export default function PillButton({
  children,
  pressed = false,
  onClick,
  compact = false,
  disabled = false,
  letter,
  columnLayout = false,
}: PillButtonProps): React.ReactElement {
  const classes = [
    'pill',
    compact ? 'compact' : '',
    columnLayout ? 'column-pill' : '',
  ].filter(Boolean).join(' ');

  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      disabled={disabled}
      className={classes}
    >
      {letter && <span className="lead-letter">{letter}</span>}
      <span>{children}</span>
    </button>
  );
}

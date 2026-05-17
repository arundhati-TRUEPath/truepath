import type { CareerStep } from '@/lib/types/pathways';

interface CareerLadderProps {
  steps: CareerStep[];
}

export default function CareerLadder({ steps }: CareerLadderProps): React.ReactElement {
  return (
    <div className="ladder" style={{ ['--cols' as string]: steps.length }}>
      {steps.map((step, i) => (
        <div key={i} style={{ display: 'contents' }}>
          <div className={`ladder-step${step.current ? ' current' : ''}`}>
            <div className="role">{step.role}</div>
            <div className="meta">{step.meta}</div>
          </div>
          {i < steps.length - 1 && (
            <div className="ladder-arrow" aria-hidden="true">
              <svg width="20" height="12" viewBox="0 0 20 12" fill="none">
                <path d="M1 6h17M13 1l5 5-5 5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

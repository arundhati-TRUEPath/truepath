'use client';

import type { Skill } from '@/lib/types/skills';

interface SkillsGridProps {
  skills: Skill[];
  confirmedIds: string[];
  onToggle: (id: string) => void;
}

export default function SkillsGrid({ skills, confirmedIds, onToggle }: SkillsGridProps): React.ReactElement {
  return (
    <div className="skills-grid">
      {skills.map((s) => {
        const on = confirmedIds.includes(s.id);
        return (
          <button
            key={s.id}
            type="button"
            className="skill-chip"
            data-on={on}
            onClick={() => onToggle(s.id)}
            aria-pressed={on}
          >
            <span className="check" aria-hidden="true">
              <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                <path d="M2.5 6.2l2.4 2.4 4.6-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <div className="label">{s.label}</div>
            <div className="sub">{s.sub}</div>
          </button>
        );
      })}
    </div>
  );
}

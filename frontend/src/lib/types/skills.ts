export interface Skill {
  id: string;
  label: string;
  sub: string;
  confidence: 'high' | 'medium';
}

export interface SkillsResponse {
  skills: Skill[];
  rationale: string;
}

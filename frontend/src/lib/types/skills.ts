export interface Skill {
  id: string;
  label: string;
  sub: string;
}

export interface SkillsResponse {
  skills: Skill[];
  rationale: string;
}

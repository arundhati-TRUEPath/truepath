export type SessionStatus = 'in_progress' | 'seed_complete' | 'followup_complete' | 'skills_complete';

export interface Session {
  id: string;
  createdAt: string;
  status: SessionStatus;
}

import client from './client';
import type { IntakeAnswer, FollowupResponse, Question } from '../types/intake';
import type { SkillsResponse } from '../types/skills';
import type { PathwayResponse } from '../types/pathways';
import type { PlanResponse } from '../types/plan';

export const fetchSeedQuestions = (): Promise<Question[]> =>
  client.get<Question[]>('/intake/questions').then((r) => r.data);

export const fetchFollowupQuestion = (answers: IntakeAnswer[]): Promise<FollowupResponse> =>
  client.post<FollowupResponse>('/intake/followup', { answers }).then((r) => r.data);

export const inferSkills = (answers: IntakeAnswer[]): Promise<SkillsResponse> =>
  client.post<SkillsResponse>('/skills/infer', { answers }).then((r) => r.data);

export const recommendPathways = (
  answers: IntakeAnswer[],
  confirmedSkillIds: string[],
): Promise<PathwayResponse> =>
  client.post<PathwayResponse>('/pathways/recommend', { answers, confirmedSkillIds }).then((r) => r.data);

export const generatePlan = (
  answers: IntakeAnswer[],
  confirmedSkillIds: string[],
  pathwayId: string,
): Promise<PlanResponse> =>
  client.post<PlanResponse>('/plan/generate', { answers, confirmedSkillIds, pathwayId }).then((r) => r.data);

export const downloadPdf = (sessionId: string): Promise<Blob> =>
  client.get<Blob>(`/plan/pdf/${sessionId}`, { responseType: 'blob' }).then((r) => r.data);

export const logEvent = (event: string, payload: Record<string, unknown>): Promise<void> =>
  client.post('/analytics/event', { event, ...payload }).then(() => undefined);

import client from './client';
import type { ApiResponse } from './client';
import type { IntakeAnswer, FollowupResponse, Question } from '../types/intake';
import type { SkillsResponse } from '../types/skills';
import type { PathwayResponse } from '../types/pathways';
import type { PlanResponse } from '../types/plan';

const v1 = '/api/v1';

export const startSession = (): Promise<{ sessionId: string }> =>
  client
    .post<ApiResponse<{ sessionId: string }>>(`${v1}/sessions/start`)
    .then((r) => r.data.data!);

export const fetchSeedQuestions = (): Promise<Question[]> =>
  client
    .get<ApiResponse<Question[]>>(`${v1}/intake/questions`)
    .then((r) => r.data.data!);

export const submitSeedAnswers = (
  sessionId: string,
  answers: IntakeAnswer[],
): Promise<FollowupResponse> =>
  client
    .post<ApiResponse<FollowupResponse>>(`${v1}/intake/followup`, { sessionId, answers })
    .then((r) => r.data.data!);

export const inferSkills = (answers: IntakeAnswer[]): Promise<SkillsResponse> =>
  client
    .post<SkillsResponse>(`${v1}/skills/infer`, { answers })
    .then((r) => r.data);

export const recommendPathways = (
  answers: IntakeAnswer[],
  confirmedSkillIds: string[],
): Promise<PathwayResponse> =>
  client
    .post<PathwayResponse>(`${v1}/pathways/recommend`, { answers, confirmedSkillIds })
    .then((r) => r.data);

export const generatePlan = (
  answers: IntakeAnswer[],
  confirmedSkillIds: string[],
  pathwayId: string,
): Promise<PlanResponse> =>
  client
    .post<PlanResponse>(`${v1}/plan/generate`, { answers, confirmedSkillIds, pathwayId })
    .then((r) => r.data);

export const logEvent = (event: string, payload: Record<string, unknown>): Promise<void> =>
  client.post(`${v1}/analytics/event`, { event, ...payload }).then(() => undefined);

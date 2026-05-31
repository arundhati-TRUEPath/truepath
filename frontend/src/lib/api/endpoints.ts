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

export const submitFollowupAnswers = (
  sessionId: string,
  answers: IntakeAnswer[],
): Promise<{ status: string }> =>
  client
    .post<ApiResponse<{ status: string }>>(`${v1}/intake/followup/submit`, { sessionId, answers })
    .then((r) => r.data.data!);

export const inferSkills = (sessionId: string): Promise<SkillsResponse> =>
  client
    .post<ApiResponse<SkillsResponse>>(`${v1}/skills/infer`, { sessionId })
    .then((r) => r.data.data!);

export const confirmSkills = (sessionId: string, confirmedIds: string[]): Promise<void> =>
  client
    .post<ApiResponse<{ status: string }>>(`${v1}/skills/confirm`, { sessionId, confirmedIds })
    .then(() => undefined);

export const recommendPathways = (sessionId: string): Promise<PathwayResponse> =>
  client
    .post<ApiResponse<PathwayResponse>>(`${v1}/pathways/recommend`, { sessionId })
    .then((r) => r.data.data!);

export const pathwaysPdfUrl = (sessionId: string): string =>
  `${v1}/pathways/export-pdf?sessionId=${encodeURIComponent(sessionId)}`;

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

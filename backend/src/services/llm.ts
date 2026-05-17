import { randomUUID } from 'crypto';
import OpenAI from 'openai';
import { z } from 'zod';
import { config } from '../config';
import { logger } from '../logger';
import { FOLLOWUP_SYSTEM_PROMPT } from '../prompts/followup-system-prompt';
import { SKILLS_SYSTEM_PROMPT } from '../prompts/skills-system-prompt';
import type { IntakeAnswer, Question } from '../types/intake';
import type { SessionQA } from '../repositories/sessions.repo';

const LlmOptionSchema = z.object({
  option_key: z.string().min(1),
  label: z.string().min(1),
});

const QUESTION_CATEGORIES = [
  'barriers', 'schedule', 'caregiving', 'finances', 'motivation',
  'experience', 'credentials', 'support', 'location', 'readiness',
] as const;

const LlmQuestionSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  hint: z.string().min(1),
  is_multi: z.boolean(),
  layout: z.enum(['wrap', 'column']),
  rationale: z.string().min(1),
  question_category: z.enum(QUESTION_CATEGORIES),
  options: z.array(LlmOptionSchema).min(2).max(8),
});

const LlmResponseSchema = z.object({
  questions: z.array(LlmQuestionSchema).length(3),
});

type LlmQuestion = z.infer<typeof LlmQuestionSchema>;

export interface FollowupQuestionInsert {
  id: string;
  title: string;
  hint: string;
  isMulti: boolean;
  layout: 'wrap' | 'column';
  displayOrder: number;
  category: string;
  aiId: string;
  choices: Array<{ optionKey: string; label: string; displayOrder: number }>;
}

function buildUserMessage(seedQuestions: Question[], answers: IntakeAnswer[]): string {
  const answerMap = new Map(answers.map((a) => [a.questionId, a.optionIds]));
  const lines = seedQuestions.map((q, i) => {
    const selectedIds = answerMap.get(q.id) ?? [];
    const selectedLabels = selectedIds
      .map((id) => q.options.find((o) => o.id === id)?.label ?? id)
      .join(', ');
    return `${i + 1}. ${q.title}\n   Answer: ${selectedLabels || '(no answer)'}`;
  });
  return `Here are the user's responses to the 7 intake questions:\n\n${lines.join('\n\n')}`;
}

export function llmQuestionsToInsert(llmQuestions: LlmQuestion[]): FollowupQuestionInsert[] {
  return llmQuestions.map((q, i) => ({
    id: randomUUID(),
    title: q.title,
    hint: q.hint,
    isMulti: q.is_multi,
    layout: q.layout,
    displayOrder: i + 1,
    category: q.question_category,
    aiId: q.id,
    choices: q.options.map((o, j) => ({
      optionKey: o.option_key,
      label: o.label,
      displayOrder: j + 1,
    })),
  }));
}

export function insertDataToQuestions(
  insertData: FollowupQuestionInsert[],
  llmQuestions: LlmQuestion[],
): Question[] {
  return insertData.map((q, i) => ({
    id: q.id,
    title: q.title,
    hint: q.hint,
    ...(q.isMulti ? { multi: true } : {}),
    layout: q.layout,
    rationale: llmQuestions[i].rationale,
    options: q.choices.map((c) => ({ id: c.optionKey, label: c.label })),
  }));
}

export async function generateFollowupQuestions(
  seedQuestions: Question[],
  answers: IntakeAnswer[],
): Promise<{ insertData: FollowupQuestionInsert[]; questions: Question[] }> {
  if (!config.openai.apiKey) {
    throw new Error(
      'OPENAI_API_KEY is not set. Add it to backend/.env to enable LLM followup generation.',
    );
  }

  const client = new OpenAI({ apiKey: config.openai.apiKey });
  const userMessage = buildUserMessage(seedQuestions, answers);

  const messages = [
    { role: 'system' as const, content: FOLLOWUP_SYSTEM_PROMPT },
    { role: 'user' as const, content: userMessage },
  ];

  logger.info({ event: 'llm_followup_request', model: config.openai.followupModel, messages });

  const completion = await client.chat.completions.create({
    model: config.openai.followupModel,
    response_format: { type: 'json_object' },
    messages,
  });

  const raw = completion.choices[0]?.message?.content;
  logger.info({ event: 'llm_followup_response', raw });
  if (!raw) throw new Error('Empty response from OpenAI');

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('OpenAI returned non-JSON content');
  }

  const validated = LlmResponseSchema.safeParse(parsed);
  if (!validated.success) {
    logger.error({ event: 'llm_response_invalid', issues: validated.error.issues, raw });
    throw new Error('LLM response did not match expected schema');
  }

  const insertData = llmQuestionsToInsert(validated.data.questions);
  const questions = insertDataToQuestions(insertData, validated.data.questions);

  return { insertData, questions };
}

const LlmSkillSchema = z.object({
  id: z.string().min(1).regex(/^[a-z0-9_]+$/, 'skill id must be lowercase alphanumeric with underscores'),
  label: z.string().min(1),
  sub: z.string().min(1),
  confidence: z.enum(['high', 'medium']),
  rationale: z.string().min(1),
});

const LlmSkillsResponseSchema = z.object({
  skills: z.array(LlmSkillSchema).length(9),
});

export type LlmSkill = z.infer<typeof LlmSkillSchema>;

function buildSkillsUserMessage(qa: SessionQA[]): string {
  const lines = qa.map((item, i) => {
    const labels = item.selectedLabels.join(', ');
    return `${i + 1}. [${item.questionCategory}] ${item.questionTitle}\n   Answer: ${labels || '(no answer)'}`;
  });
  return `Here are the user's responses to all 10 intake questions:\n\n${lines.join('\n\n')}`;
}

export async function generateSkills(qa: SessionQA[]): Promise<LlmSkill[]> {
  if (!config.openai.apiKey) {
    throw new Error('OPENAI_API_KEY is not set.');
  }

  const client = new OpenAI({ apiKey: config.openai.apiKey });
  const userMessage = buildSkillsUserMessage(qa);

  const messages = [
    { role: 'system' as const, content: SKILLS_SYSTEM_PROMPT },
    { role: 'user' as const, content: userMessage },
  ];

  logger.info({ event: 'llm_skills_request', model: config.openai.skillsModel });

  const completion = await client.chat.completions.create({
    model: config.openai.skillsModel,
    response_format: { type: 'json_object' },
    messages,
  });

  const raw = completion.choices[0]?.message?.content;
  logger.info({ event: 'llm_skills_response', raw });
  if (!raw) throw new Error('Empty response from OpenAI');

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('OpenAI returned non-JSON content');
  }

  const validated = LlmSkillsResponseSchema.safeParse(parsed);
  if (!validated.success) {
    logger.error({ event: 'llm_skills_response_invalid', issues: validated.error.issues, raw });
    throw new Error('LLM skills response did not match expected schema');
  }

  return validated.data.skills;
}

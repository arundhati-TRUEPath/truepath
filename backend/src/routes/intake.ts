import { Router } from 'express';
import { z } from 'zod';
import { getAllSeedQuestions } from '../repositories/questions.repo';
import { saveResponses, updateSessionStatus } from '../repositories/sessions.repo';
import { ValidationError } from '../errors/AppError';
import { logger } from '../logger';
import type { ApiResponse, FollowupResponse, Question } from '../types/intake';

const router = Router();

const IntakeAnswerSchema = z.object({
  questionId: z.string().min(1),
  optionIds: z.array(z.string().min(1)).min(1),
});

const FollowupBodySchema = z.object({
  sessionId: z.string().uuid(),
  answers: z.array(IntakeAnswerSchema).length(7),
});

const STUB_FOLLOWUP_QUESTIONS: Question[] = [
  {
    id: 'fu_caregiving',
    title: 'Have you done caregiving before — paid or unpaid?',
    rationale: 'Your answers suggest caregiving experience may open faster pathways.',
    layout: 'wrap',
    options: [
      { id: 'paid',      label: 'Yes — paid (home health, CNA, etc.)' },
      { id: 'family',    label: 'Yes — for a family member' },
      { id: 'volunteer', label: 'Yes — volunteer or informal' },
      { id: 'no',        label: 'No, not really' },
    ],
  },
  {
    id: 'fu_priorities',
    title: 'What matters most in your next job?',
    rationale: 'Helps us rank pathways by what you actually need.',
    multi: true,
    layout: 'wrap',
    options: [
      { id: 'income',   label: 'Steady income' },
      { id: 'benefits', label: 'Health benefits' },
      { id: 'schedule', label: 'Predictable schedule' },
      { id: 'growth',   label: 'Room to advance' },
      { id: 'meaning',  label: 'Helping people directly' },
    ],
  },
  {
    id: 'fu_barriers',
    title: 'Is anything likely to slow down your training start?',
    rationale: 'Flagging this now helps us pick pathways that actually fit your timeline.',
    multi: true,
    layout: 'wrap',
    options: [
      { id: 'financial', label: 'Need to find funding first' },
      { id: 'housing',   label: 'Housing instability' },
      { id: 'language',  label: 'English language support needed' },
      { id: 'none',      label: 'Nothing major — ready to start' },
    ],
  },
];

router.get('/questions', async (_req, res, next) => {
  try {
    const questions = await getAllSeedQuestions();
    const body: ApiResponse<Question[]> = { data: questions, error: null, meta: null };
    res.json(body);
  } catch (err) {
    next(err);
  }
});

router.post('/followup', async (req, res, next) => {
  try {
    const parsed = FollowupBodySchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues.map((i) => i.message).join('; '));
    }

    const { sessionId, answers } = parsed.data;

    await saveResponses(sessionId, answers, 'seed');
    await updateSessionStatus(sessionId, 'seed_complete');

    logger.info({
      event: 'llm_followup_stub',
      sessionId,
      message: 'LLM would be called here to generate 3 personalized follow-up questions based on seed answers.',
      answerCount: answers.length,
    });

    const body: ApiResponse<FollowupResponse> = {
      data: { questions: STUB_FOLLOWUP_QUESTIONS },
      error: null,
      meta: null,
    };
    res.json(body);
  } catch (err) {
    next(err);
  }
});

export default router;

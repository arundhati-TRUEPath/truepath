import { Router } from 'express';
import { z } from 'zod';
import { getAllSeedQuestions, insertFollowupQuestions } from '../repositories/questions.repo';
import { saveResponses, updateSessionStatus } from '../repositories/sessions.repo';
import { generateFollowupQuestions } from '../services/llm';
import { ValidationError } from '../errors/AppError';
import { logger } from '../logger';
import type { ApiResponse, FollowupResponse } from '../types/intake';

const router = Router();

const IntakeAnswerSchema = z.object({
  questionId: z.string().min(1),
  optionIds: z.array(z.string().min(1)).min(1),
});

const FollowupBodySchema = z.object({
  sessionId: z.string().uuid(),
  answers: z.array(IntakeAnswerSchema).length(7),
});

const FollowupSubmitBodySchema = z.object({
  sessionId: z.string().uuid(),
  answers: z.array(IntakeAnswerSchema).min(1),
});

router.get('/questions', async (_req, res, next) => {
  try {
    const questions = await getAllSeedQuestions();
    const body: ApiResponse<typeof questions> = { data: questions, error: null, meta: null };
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

    const seedQuestions = await getAllSeedQuestions();
    const { insertData, questions } = await generateFollowupQuestions(seedQuestions, answers);

    await insertFollowupQuestions(insertData);

    logger.info({
      event: 'llm_followup_generated',
      sessionId,
      questionCount: questions.length,
      model: process.env['OPENAI_FOLLOWUP_MODEL'] ?? 'gpt-4.1-mini',
    });

    const body: ApiResponse<FollowupResponse> = {
      data: { questions },
      error: null,
      meta: null,
    };
    res.json(body);
  } catch (err) {
    next(err);
  }
});

router.post('/followup/submit', async (req, res, next) => {
  try {
    const parsed = FollowupSubmitBodySchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues.map((i) => i.message).join('; '));
    }

    const { sessionId, answers } = parsed.data;
    const nonEmpty = answers.filter((a) => a.optionIds.length > 0);

    await saveResponses(sessionId, nonEmpty, 'ai');
    await updateSessionStatus(sessionId, 'followup_complete');

    logger.info({
      event: 'followup_submitted',
      sessionId,
      answerCount: nonEmpty.length,
    });

    const body: ApiResponse<{ status: string }> = {
      data: { status: 'complete' },
      error: null,
      meta: null,
    };
    res.json(body);
  } catch (err) {
    next(err);
  }
});

export default router;

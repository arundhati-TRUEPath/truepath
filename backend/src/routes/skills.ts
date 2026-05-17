import { Router } from 'express';
import { z } from 'zod';
import { generateSkills } from '../services/llm';
import { saveSkills, getSkills, confirmSkills } from '../repositories/skills.repo';
import { getSessionQA, updateSessionStatus } from '../repositories/sessions.repo';
import { ValidationError } from '../errors/AppError';
import { logger } from '../logger';
import type { ApiResponse } from '../types/intake';
import type { ClientSkill } from '../repositories/skills.repo';

const router = Router();

const InferBodySchema = z.object({
  sessionId: z.string().uuid(),
});

const ConfirmBodySchema = z.object({
  sessionId: z.string().uuid(),
  confirmedIds: z.array(z.string().min(1)).min(1),
});

interface SkillsResponse {
  skills: ClientSkill[];
  rationale: string;
}

router.post('/infer', async (req, res, next) => {
  try {
    const parsed = InferBodySchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues.map((i) => i.message).join('; '));
    }

    const { sessionId } = parsed.data;

    const existing = await getSkills(sessionId);
    if (existing.length > 0) {
      const highCount = existing.filter((s) => s.confidence === 'high').length;
      const rationale = buildRationale(highCount, existing.length);
      const body: ApiResponse<SkillsResponse> = {
        data: { skills: existing, rationale },
        error: null,
        meta: null,
      };
      res.json(body);
      return;
    }

    const qa = await getSessionQA(sessionId);
    if (qa.length === 0) {
      throw new ValidationError('No responses found for this session');
    }

    const skills = await generateSkills(qa);

    await saveSkills(sessionId, skills);
    await updateSessionStatus(sessionId, 'skills_complete');

    logger.info({ event: 'skills_generated', sessionId, count: skills.length });

    const clientSkills: ClientSkill[] = skills.map((s) => ({
      id: s.id,
      label: s.label,
      sub: s.sub,
      confidence: s.confidence,
    }));

    const highCount = clientSkills.filter((s) => s.confidence === 'high').length;
    const body: ApiResponse<SkillsResponse> = {
      data: { skills: clientSkills, rationale: buildRationale(highCount, clientSkills.length) },
      error: null,
      meta: null,
    };
    res.json(body);
  } catch (err) {
    next(err);
  }
});

router.post('/confirm', async (req, res, next) => {
  try {
    const parsed = ConfirmBodySchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues.map((i) => i.message).join('; '));
    }

    const { sessionId, confirmedIds } = parsed.data;

    await confirmSkills(sessionId, confirmedIds);

    logger.info({ event: 'skills_confirmed', sessionId, confirmedCount: confirmedIds.length });

    const body: ApiResponse<{ status: string }> = {
      data: { status: 'confirmed' },
      error: null,
      meta: null,
    };
    res.json(body);
  } catch (err) {
    next(err);
  }
});

function buildRationale(highCount: number, total: number): string {
  return `We identified ${total} transferable skills from your answers. The ${highCount} highlighted below had the strongest evidence — deselect any that don't feel like you.`;
}

export default router;

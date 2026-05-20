import { Router } from 'express';
import { z } from 'zod';
import { generatePathwayRecommendations } from '../services/pathways';
import { streamPathwaysPdf } from '../services/pdf';
import { getSessionQA, updateSessionStatus } from '../repositories/sessions.repo';
import { getConfirmedSkills } from '../repositories/skills.repo';
import { getPathways, savePathways } from '../repositories/pathways.repo';
import { ValidationError, NotFoundError } from '../errors/AppError';
import { logger } from '../logger';
import type { ApiResponse } from '../types/intake';
import type { Pathway, Limitations } from '../repositories/pathways.repo';

const router = Router();

const RecommendBodySchema = z.object({
  sessionId: z.string().uuid(),
});

interface PathwayResponse {
  pathways: Pathway[];
  limitations: Limitations;
}

router.post('/recommend', async (req, res, next) => {
  try {
    const parsed = RecommendBodySchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues.map((i) => i.message).join('; '));
    }

    const { sessionId } = parsed.data;

    const cached = await getPathways(sessionId);
    if (cached) {
      const body: ApiResponse<PathwayResponse> = {
        data: { pathways: cached.pathways, limitations: cached.limitations },
        error: null,
        meta: { sourceFiles: cached.sourceFiles, cached: true },
      };
      res.json(body);
      return;
    }

    const qa = await getSessionQA(sessionId);
    if (qa.length === 0) {
      throw new ValidationError('No responses found for this session');
    }

    const skills = await getConfirmedSkills(sessionId);

    const result = await generatePathwayRecommendations(qa, skills);
    await savePathways(sessionId, result);
    await updateSessionStatus(sessionId, 'pathways_complete');

    logger.info({
      event: 'pathways_generated',
      sessionId,
      sourceFiles: result.sourceFiles,
    });

    const body: ApiResponse<PathwayResponse> = {
      data: { pathways: result.pathways, limitations: result.limitations },
      error: null,
      meta: { sourceFiles: result.sourceFiles, cached: false },
    };
    res.json(body);
  } catch (err) {
    next(err);
  }
});

const ExportQuerySchema = z.object({
  sessionId: z.string().uuid(),
});

router.get('/export-pdf', async (req, res, next) => {
  try {
    const parsed = ExportQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues.map((i) => i.message).join('; '));
    }

    const { sessionId } = parsed.data;
    const saved = await getPathways(sessionId);
    if (!saved) {
      throw new NotFoundError('No pathway recommendations found for this session. Generate them first.');
    }

    logger.info({ event: 'pathways_pdf_export', sessionId, count: saved.pathways.length });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="truepath-pathways-${sessionId.slice(0, 8)}.pdf"`,
    );

    streamPathwaysPdf(res, saved.pathways, saved.limitations, saved.sourceFiles);
  } catch (err) {
    next(err);
  }
});

export default router;

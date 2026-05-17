import { Router } from 'express';
import { createSession } from '../repositories/sessions.repo';
import type { ApiResponse } from '../types/intake';

const router = Router();

router.post('/start', async (_req, res, next) => {
  try {
    const session = await createSession();
    const body: ApiResponse<{ sessionId: string }> = {
      data: { sessionId: session.id },
      error: null,
      meta: null,
    };
    res.status(201).json(body);
  } catch (err) {
    next(err);
  }
});

export default router;

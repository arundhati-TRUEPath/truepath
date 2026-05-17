import { Router } from 'express';

const router = Router();

router.get('/questions', (_req, res) => {
  res.json([]);
});

router.post('/followup', (_req, res) => {
  res.json({ question: null, done: true });
});

export default router;

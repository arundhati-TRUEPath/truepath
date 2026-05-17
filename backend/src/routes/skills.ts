import { Router } from 'express';

const router = Router();

router.post('/infer', (_req, res) => {
  res.json({ skills: [], rationale: '' });
});

export default router;

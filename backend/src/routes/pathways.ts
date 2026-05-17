import { Router } from 'express';

const router = Router();

router.post('/recommend', (_req, res) => {
  res.json({ pathways: [], limitations: { headline: '', summary: '', bullets: [] } });
});

export default router;

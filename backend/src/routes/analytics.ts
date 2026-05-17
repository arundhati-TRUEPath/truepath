import { Router } from 'express';

const router = Router();

router.post('/event', (_req, res) => {
  res.status(204).send();
});

export default router;

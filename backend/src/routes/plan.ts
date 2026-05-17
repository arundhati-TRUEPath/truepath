import { Router } from 'express';

const router = Router();

router.post('/generate', (_req, res) => {
  res.json({ plan: null, pdfUrl: '' });
});

router.get('/pdf/:sessionId', (_req, res) => {
  res.status(501).json({ message: 'PDF generation not yet implemented.' });
});

export default router;

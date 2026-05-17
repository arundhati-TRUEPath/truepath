import { Router } from 'express';
import sessionsRouter from './sessions';
import intakeRouter from './intake';
import skillsRouter from './skills';
import pathwaysRouter from './pathways';
import planRouter from './plan';
import analyticsRouter from './analytics';

const router = Router();

router.use('/sessions', sessionsRouter);
router.use('/intake', intakeRouter);
router.use('/skills', skillsRouter);
router.use('/pathways', pathwaysRouter);
router.use('/plan', planRouter);
router.use('/analytics', analyticsRouter);

export default router;

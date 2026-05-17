import express from 'express';
import cors from 'cors';
import { config } from './config';
import router from './routes';
import { errorMiddleware } from './middleware/error';

export function createApp() {
  const app = express();

  app.use(cors({ origin: config.corsOrigin }));
  app.use(express.json());

  app.get('/health', (_req, res) => res.json({ status: 'ok' }));
  app.use(router);
  app.use(errorMiddleware);

  return app;
}

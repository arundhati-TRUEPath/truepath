import express from 'express';
import cors from 'cors';
import { randomUUID } from 'crypto';
import { config } from './config';
import router from './routes';
import { errorMiddleware } from './middleware/error';
import { requestLogger } from './middleware/requestLogger';

export function createApp() {
  const app = express();

  app.use(cors({ origin: config.corsOrigin }));
  app.use(express.json());

  app.use((_req, res, next) => {
    res.locals['requestId'] = randomUUID();
    res.setHeader('X-Request-ID', res.locals['requestId'] as string);
    next();
  });

  app.use(requestLogger);

  app.get('/health', (_req, res) => res.json({ status: 'ok' }));

  app.use('/api/v1', router);

  app.use(errorMiddleware);

  return app;
}

import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../errors/AppError';
import { logger } from '../logger';

export function errorMiddleware(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof AppError && err.isOperational) {
    res.status(err.statusCode).json({
      data: null,
      error: { code: err.code, message: err.message },
      meta: null,
    });
    return;
  }

  const message = err instanceof Error ? err.message : 'Internal server error';
  logger.error({ event: 'unhandled_error', message, stack: err instanceof Error ? err.stack : undefined });
  res.status(500).json({
    data: null,
    error: { code: 'server_error', message: 'Something went wrong. Please try again.' },
    meta: null,
  });
}

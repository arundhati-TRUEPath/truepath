import type { Request, Response, NextFunction } from 'express';

export interface ApiError {
  code: string;
  message: string;
}

export function errorMiddleware(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const message = err instanceof Error ? err.message : 'Internal server error';
  res.status(500).json({ code: 'server_error', message });
}

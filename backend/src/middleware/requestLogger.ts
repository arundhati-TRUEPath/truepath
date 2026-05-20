import type { Request, Response, NextFunction } from 'express';
import { logger } from '../logger';

const BODY_MAX_CHARS = 8_000;
const SENSITIVE_HEADERS = new Set(['authorization', 'cookie', 'x-api-key']);

function truncate(value: unknown): unknown {
  if (value === undefined) return undefined;
  try {
    const json = JSON.stringify(value);
    if (json.length <= BODY_MAX_CHARS) return value;
    return { _truncated: true, _originalLength: json.length, preview: json.slice(0, BODY_MAX_CHARS) };
  } catch {
    return '[unserializable]';
  }
}

function safeHeaders(headers: Record<string, string | string[] | undefined>): Record<string, string | string[]> {
  const out: Record<string, string | string[]> = {};
  for (const [key, value] of Object.entries(headers)) {
    if (value === undefined) continue;
    out[key] = SENSITIVE_HEADERS.has(key.toLowerCase()) ? '[redacted]' : value;
  }
  return out;
}

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const requestId = (res.locals['requestId'] as string | undefined) ?? 'unknown';
  const startNs = process.hrtime.bigint();

  logger.info({
    event: 'http_request',
    requestId,
    method: req.method,
    path: req.path,
    query: Object.keys(req.query).length ? req.query : undefined,
    headers: safeHeaders(req.headers),
    body: req.body && Object.keys(req.body).length ? truncate(req.body) : undefined,
  });

  let capturedBody: unknown;
  const originalJson = res.json.bind(res);
  res.json = (body: unknown) => {
    capturedBody = body;
    return originalJson(body);
  };

  const originalSend = res.send.bind(res);
  res.send = (body: unknown) => {
    if (capturedBody === undefined) {
      if (typeof body === 'string') {
        try { capturedBody = JSON.parse(body); } catch { capturedBody = body; }
      } else {
        capturedBody = body;
      }
    }
    return originalSend(body as never);
  };

  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - startNs) / 1_000_000;
    const isBinary = (res.getHeader('content-type') as string | undefined)?.includes('application/pdf');
    logger.info({
      event: 'http_response',
      requestId,
      method: req.method,
      path: req.path,
      status: res.statusCode,
      durationMs: Number(durationMs.toFixed(1)),
      body: isBinary
        ? { _binary: true, contentType: res.getHeader('content-type'), bytes: res.getHeader('content-length') }
        : capturedBody !== undefined ? truncate(capturedBody) : undefined,
    });
  });

  next();
}

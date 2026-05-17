import pino from 'pino';
import { createWriteStream, mkdirSync } from 'fs';
import { join } from 'path';

const LOGS_DIR = join(__dirname, '../../logs');
const ROLL_MS = 24 * 60 * 60 * 1000;

const LEVEL_NAMES: Record<number, string> = {
  10: 'TRACE',
  20: 'DEBUG',
  30: 'INFO',
  40: 'WARN',
  50: 'ERROR',
  60: 'FATAL',
};

mkdirSync(LOGS_DIR, { recursive: true });

function logFilePath(): string {
  const ts = new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-');
  return join(LOGS_DIR, `backend_${ts}.log`);
}

function parseJsonStrings(val: unknown): unknown {
  if (typeof val === 'string' && (val.startsWith('{') || val.startsWith('['))) {
    try {
      return parseJsonStrings(JSON.parse(val));
    } catch {
      return val;
    }
  }
  if (Array.isArray(val)) return val.map(parseJsonStrings);
  if (val !== null && typeof val === 'object') {
    return Object.fromEntries(
      Object.entries(val as Record<string, unknown>).map(([k, v]) => [k, parseJsonStrings(v)]),
    );
  }
  return val;
}

function prettyFormat(msg: string): string {
  try {
    const obj = parseJsonStrings(JSON.parse(msg)) as Record<string, unknown>;
    const level = typeof obj['level'] === 'number'
      ? (LEVEL_NAMES[obj['level']] ?? String(obj['level']))
      : obj['level'];
    return JSON.stringify({ ...obj, level }, null, 2) + '\n\n';
  } catch {
    return msg;
  }
}

class RotatingFileStream {
  private stream = createWriteStream(logFilePath(), { flags: 'a' });

  constructor() {
    const timer = setInterval(() => this.rotate(), ROLL_MS);
    timer.unref();
  }

  private rotate(): void {
    const old = this.stream;
    this.stream = createWriteStream(logFilePath(), { flags: 'a' });
    old.end();
  }

  write(msg: string): void {
    this.stream.write(prettyFormat(msg));
  }
}

export const logger = pino(
  {
    level: process.env['NODE_ENV'] === 'production' ? 'info' : 'debug',
    base: { service: 'truepath-backend' },
    timestamp: pino.stdTimeFunctions.isoTime,
  },
  pino.multistream([
    { stream: process.stdout },
    { stream: new RotatingFileStream() },
  ]),
);

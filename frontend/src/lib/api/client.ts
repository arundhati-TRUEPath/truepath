import axios, { type InternalAxiosRequestConfig } from 'axios';

export interface AppError {
  code: 'network' | 'timeout' | 'ai_error' | 'validation' | 'unknown';
  message: string;
  retryable: boolean;
}

export interface ApiResponse<T> {
  data: T | null;
  error: { code: string; message: string } | null;
  meta: Record<string, unknown> | null;
}

const client = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000',
  timeout: 90_000,
  headers: { 'Content-Type': 'application/json' },
});

type TimedConfig = InternalAxiosRequestConfig & { metadata?: { start: number } };

client.interceptors.request.use((cfg) => {
  const c = cfg as TimedConfig;
  c.metadata = { start: performance.now() };
  console.log('[api →]', cfg.method?.toUpperCase(), `${cfg.baseURL ?? ''}${cfg.url ?? ''}`, {
    params: cfg.params,
    body: cfg.data,
  });
  return cfg;
});

client.interceptors.response.use(
  (res) => {
    const c = res.config as TimedConfig;
    const ms = c.metadata ? Math.round(performance.now() - c.metadata.start) : undefined;
    console.log('[api ←]', res.status, res.config.method?.toUpperCase(), res.config.url, {
      durationMs: ms,
      data: res.data,
    });
    return res;
  },
  (err) => {
    const c = err.config as TimedConfig | undefined;
    const ms = c?.metadata ? Math.round(performance.now() - c.metadata.start) : undefined;
    console.error('[api ✗]', err.response?.status ?? err.code, err.config?.method?.toUpperCase(), err.config?.url, {
      durationMs: ms,
      data: err.response?.data,
      message: err.message,
    });
    const apiError = err.response?.data?.error as { message?: string } | undefined;
    const appError: AppError = {
      code:
        err.code === 'ECONNABORTED' ? 'timeout'
        : !err.response ? 'network'
        : err.response.status >= 500 ? 'ai_error'
        : err.response.status === 422 ? 'validation'
        : 'unknown',
      message: apiError?.message ?? err.message ?? 'Something went wrong.',
      retryable: !err.response || err.response.status >= 500,
    };
    return Promise.reject(appError);
  },
);

export default client;

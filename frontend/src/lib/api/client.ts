import axios from 'axios';

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
  timeout: 30_000,
  headers: { 'Content-Type': 'application/json' },
});

client.interceptors.response.use(
  (res) => res,
  (err) => {
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

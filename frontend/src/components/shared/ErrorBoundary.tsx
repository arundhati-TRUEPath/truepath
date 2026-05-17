'use client';

import { Component, type ReactNode } from 'react';
import type { AppError } from '@/lib/api/client';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  error: AppError | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(): State {
    return { error: { code: 'unknown', message: 'Something went wrong.', retryable: false } };
  }

  render() {
    if (this.state.error) return this.props.fallback ?? null;
    return this.props.children;
  }
}

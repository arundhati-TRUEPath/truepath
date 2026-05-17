export interface QuestionOption {
  id: string;
  label: string;
}

export interface Question {
  id: string;
  title: string;
  hint?: string;
  multi?: boolean;
  layout: 'wrap' | 'column';
  options: QuestionOption[];
  rationale?: string;
}

export interface IntakeAnswer {
  questionId: string;
  optionIds: string[];
}

export interface FollowupResponse {
  questions: Question[];
}

export interface ApiResponse<T> {
  data: T | null;
  error: { code: string; message: string } | null;
  meta: Record<string, unknown> | null;
}

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
  question: Question | null;
  done: boolean;
}

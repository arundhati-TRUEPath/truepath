export interface PlanNextStep {
  title: string;
  detail: string;
}

export interface Plan {
  sessionId: string;
  background: string;
  pathwayTitle: string;
  pathwaySummary: string;
  nextSteps: PlanNextStep[];
  generatedAt: string;
}

export interface PlanResponse {
  plan: Plan;
  pdfUrl: string;
}

'use client';

import { create } from 'zustand';
import type { IntakeAnswer, Question } from '../types/intake';
import type { Skill } from '../types/skills';
import type { Pathway, Limitations } from '../types/pathways';

interface SessionState {
  sessionId: string;
  intakeAnswers: IntakeAnswer[];
  followupQuestions: Question[];
  inferredSkills: Skill[];
  confirmedSkillIds: string[];
  pathways: Pathway[];
  limitations: Limitations | null;
  selectedPathwayId: string | null;
  planReady: boolean;

  setSessionId: (id: string) => void;
  setIntakeAnswers: (answers: IntakeAnswer[]) => void;
  setFollowupQuestions: (questions: Question[]) => void;
  setInferredSkills: (skills: Skill[]) => void;
  setConfirmedSkillIds: (ids: string[]) => void;
  setPathways: (pathways: Pathway[], limitations: Limitations) => void;
  setSelectedPathway: (id: string) => void;
  setPlanReady: (ready: boolean) => void;
  reset: () => void;
}

const initial = {
  sessionId: '',
  intakeAnswers: [] as IntakeAnswer[],
  followupQuestions: [] as Question[],
  inferredSkills: [] as Skill[],
  confirmedSkillIds: [] as string[],
  pathways: [] as Pathway[],
  limitations: null,
  selectedPathwayId: null,
  planReady: false,
};

export const useSessionStore = create<SessionState>((set) => ({
  ...initial,
  setSessionId: (id) => set({ sessionId: id }),
  setIntakeAnswers: (answers) => set({ intakeAnswers: answers }),
  setFollowupQuestions: (questions) => set({ followupQuestions: questions }),
  setInferredSkills: (skills) => set({ inferredSkills: skills }),
  setConfirmedSkillIds: (ids) => set({ confirmedSkillIds: ids }),
  setPathways: (pathways, limitations) => set({ pathways, limitations }),
  setSelectedPathway: (id) => set({ selectedPathwayId: id }),
  setPlanReady: (ready) => set({ planReady: ready }),
  reset: () => set({ ...initial }),
}));

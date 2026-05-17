'use client';

import { create } from 'zustand';
import type { IntakeAnswer } from '../types/intake';
import type { Skill } from '../types/skills';
import type { Pathway, Limitations } from '../types/pathways';

interface SessionState {
  sessionId: string;
  intakeAnswers: IntakeAnswer[];
  inferredSkills: Skill[];
  confirmedSkillIds: string[];
  pathways: Pathway[];
  limitations: Limitations | null;
  selectedPathwayId: string | null;
  planReady: boolean;

  setIntakeAnswers: (answers: IntakeAnswer[]) => void;
  setInferredSkills: (skills: Skill[]) => void;
  setConfirmedSkillIds: (ids: string[]) => void;
  setPathways: (pathways: Pathway[], limitations: Limitations) => void;
  setSelectedPathway: (id: string) => void;
  setPlanReady: (ready: boolean) => void;
  reset: () => void;
}

const makeSessionId = () =>
  typeof crypto !== 'undefined' ? crypto.randomUUID() : Math.random().toString(36).slice(2);

const initial = {
  sessionId: makeSessionId(),
  intakeAnswers: [] as IntakeAnswer[],
  inferredSkills: [] as Skill[],
  confirmedSkillIds: [] as string[],
  pathways: [] as Pathway[],
  limitations: null,
  selectedPathwayId: null,
  planReady: false,
};

export const useSessionStore = create<SessionState>((set) => ({
  ...initial,
  setIntakeAnswers: (answers) => set({ intakeAnswers: answers }),
  setInferredSkills: (skills) => set({ inferredSkills: skills }),
  setConfirmedSkillIds: (ids) => set({ confirmedSkillIds: ids }),
  setPathways: (pathways, limitations) => set({ pathways, limitations }),
  setSelectedPathway: (id) => set({ selectedPathwayId: id }),
  setPlanReady: (ready) => set({ planReady: ready }),
  reset: () => set({ ...initial, sessionId: makeSessionId() }),
}));

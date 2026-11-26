export type Bi = { en: string; ar: string };
export type Level = "beginner" | "intermediate" | "advanced";

export interface Question {
  id: string;
  /** Skill the question checks; used for the mentor's strengths and weak points. */
  skill: string;
  prompt: string;
  options: string[];
  /** Index of the correct option in `options`. */
  correct: number;
  explanation: string;
}

export interface Quiz {
  id: string;
  questions: Question[];
}

export interface Stage {
  id: string;
  title: Bi;
  goal: string;
  explanation: string;
  /** Catalog keys of the parts this stage is about. */
  parts: string[];
  /** Version A is used first; version B after a failed attempt (then they alternate). */
  quizzes: [Quiz, Quiz];
  mentor: { alternative: string; practiceTask: string };
  /** `written`: prewritten lesson. `generated`: built from catalog and component-sheet data. */
  source: "written" | "generated";
}

export type LearningProjectId = "traffic-light" | "parking-sensor" | "irrigation";

export interface ProjectPart {
  key: string;
  quantity: number;
}

export interface LearningProject {
  id: LearningProjectId;
  title: Bi;
  summary: Bi;
  difficulty: Bi;
  parts: ProjectPart[];
  stages: Stage[];
  note?: string;
}

export interface StageProgress {
  attempts: number;
  passed: boolean;
  bestScore: number;
  lastScore: number | null;
}

export interface JourneyState {
  version: 1;
  entry: "idea" | "learning" | null;
  /** `id` is a LearningProjectId for a written path, or "custom" for a generated one. */
  project: { id: LearningProjectId | "custom"; title: Bi; description: string } | null;
  parts: ProjectPart[];
  level: Level | null;
  levelScore: number | null;
  progress: Record<string, StageProgress>;
}

export const PASS_MARK = 80;

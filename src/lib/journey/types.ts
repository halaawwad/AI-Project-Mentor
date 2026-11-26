import type { FallbackReason } from "@/lib/suggest/types";

export type Bi = { en: string; ar: string };
export type Level = "beginner" | "intermediate" | "advanced";
export type Difficulty = "easy" | "medium" | "hard";
export const DIFFICULTIES: Difficulty[] = ["easy", "medium", "hard"];
export type Language = "ar" | "en";

export interface Question {
  id: string;
  /** Skill the question checks; used for the mentor's strengths and weak points. */
  skill: string;
  difficulty: Difficulty;
  prompt: string;
  options: string[];
  /** Index of the correct option in `options`. */
  correct: number;
  explanation: string;
  /** Arabic text for local questions, with options in the same order (same `correct`). */
  ar?: { prompt: string; options: string[]; explanation: string };
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
  /** The original two quiz versions (A and B). Adaptive quizzes are drawn from `bank`. */
  quizzes: [Quiz, Quiz];
  /** Every local question for this stage, skill- and difficulty-tagged. */
  bank: Question[];
  mentor: { alternative: string; practiceTask: string };
  /** Arabic lesson text (English stays in the fields above). */
  ar: { goal: string; explanation: string; mentor: { alternative: string; practiceTask: string } };
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
  note?: Bi;
}

export interface StageProgress {
  attempts: number;
  passed: boolean;
  bestScore: number;
  lastScore: number | null;
}

export type QuizSource = "ai" | "local";

export interface WrongAnswer {
  prompt: string;
  skill: string;
  chosen: string;
  correct: string;
}

export interface StageAttempt {
  score: number;
  quizId: string;
  source: QuizSource;
  /** What the adaptive rules decided for this quiz (absent in older saved data). */
  kind?: QuizPlan["kind"];
  /** The skill the explanation before this quiz focused on. */
  focusSkill?: string;
}

export interface StageHistory {
  /** Normalized prompts of every question already asked in this stage. */
  asked: string[];
  /** Most recent wrong answers, newest first (capped). */
  wrong: WrongAnswer[];
  /** Skills missed in the latest attempt. */
  lastWrongSkills: string[];
  attempts: StageAttempt[];
  /** The prepared next quiz, cached so a reload doesn't build or request it again. */
  pending: PersonalizedQuiz | null;
}

/** One answered question: what the learner chose, what was correct, and what it checked. */
export interface AnswerRecord {
  questionId: string;
  /** Stage the question belongs to, or "level" for the level check. */
  stageId: string;
  skill: string;
  difficulty: Difficulty;
  /** Text as asked (English for local questions, the quiz language for Gemini questions). */
  prompt: string;
  chosen: string;
  /** null when the question was left unanswered. */
  chosenIndex: number | null;
  correctAnswer: string;
  correctIndex: number;
  isCorrect: boolean;
  source: QuizSource;
}

export interface LearnerProfile {
  /** Mastery per skill, 0–100. Skills not assessed yet use `baseline`. */
  mastery: Record<string, number>;
  /** Starting mastery from the level check (beginner 30, intermediate 50, advanced 70). */
  baseline: number;
  difficulty: Difficulty;
  history: Record<string, StageHistory>;
  /** Recent answer records, newest first (capped), for the mentor analysis. */
  answers: AnswerRecord[];
}

export type InsightSource = "ai" | "local";
export type Confidence = "low" | "medium" | "high";

export interface Misconception {
  skill: string;
  text: string;
}

export interface Diagnosis {
  summary: string;
  /** Skill tags. */
  strengths: string[];
  weakSkills: string[];
  /** AI: likely misconceptions. Local: recent mistakes (chosen vs. correct answer). */
  misconceptions: Misconception[];
  confidence: Confidence;
  confidenceNote: string;
}

export type PlanAction = "keep" | "add-remedial" | "shorten" | "skippable";

export interface PlanItem {
  kind: "stage" | "remedial";
  /** A stage id for `stage` items, a skill tag for `remedial` items. */
  target: string;
  action: PlanAction;
  reason: string;
  /** Gemini's personalized explanation for a remedial skill ("" when there is none). */
  explanation: string;
}

export interface LearningPlan {
  items: PlanItem[];
  /** "What changed and why" compared with the previous plan. */
  changeNote: string;
}

/** Diagnosis and plan for one checkpoint (after the level check or after a completed stage). */
export interface MentorInsight {
  id: string;
  /** "level", or "stage:<id>" after that stage was completed. */
  checkpoint: string;
  source: InsightSource;
  fallbackReason?: FallbackReason;
  language: Language;
  /** Number of answer records the analysis was based on. */
  basedOn: number;
  diagnosis: Diagnosis;
  plan: LearningPlan;
}

export interface MentorState {
  checkpoint: string;
  /** Insights for this checkpoint, at most one per language. */
  insights: MentorInsight[];
  /** The plan of the previous checkpoint, for "What changed and why". */
  previous: { checkpoint: string; source: InsightSource; items: PlanItem[] } | null;
}

/** What the adaptive rules decided for the next quiz. */
export interface QuizPlan {
  kind: "first" | "retry" | "next-stage" | "practice";
  difficulty: Difficulty;
  /** Skills the quiz concentrates on, weakest first. */
  focusSkills: string[];
  /** Weakest skill from earlier stages to review, with 1–2 questions. */
  reviewSkill: string | null;
  reviewCount: number;
  /** Difficulty was raised after 100% on the first try of the previous stage. */
  raised: boolean;
  /** Difficulty was lowered after a low score. */
  easier: boolean;
}

export interface PersonalizedQuiz {
  id: string;
  stageId: string;
  /** Attempt number this quiz is for (0 = first attempt). */
  attempt: number;
  source: QuizSource;
  /** Why the local bank was used instead of Gemini. */
  fallbackReason?: FallbackReason;
  plan: QuizPlan;
  language: Language;
  /** Personalized explanation of the weak points (AI) or the prewritten one (local). */
  explanation: string;
  practiceTask: string;
  questions: Question[];
}

export interface JourneyState {
  version: 1;
  /** Language for personalized content; Arabic by default. */
  language: Language;
  profile: LearnerProfile | null;
  entry: "idea" | "learning" | null;
  /** `id` is a LearningProjectId for a written path, or "custom" for a generated one. */
  project: { id: LearningProjectId | "custom"; title: Bi; description: string } | null;
  parts: ProjectPart[];
  level: Level | null;
  levelScore: number | null;
  progress: Record<string, StageProgress>;
  /** Mentor analysis and personalized plan (phase 6); null until the first checkpoint. */
  mentor: MentorState | null;
}

export const PASS_MARK = 80;

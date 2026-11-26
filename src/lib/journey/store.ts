import { useSyncExternalStore } from "react";
import { catalogByKey } from "@/lib/componentCatalog";
import { LEGACY_KEYS } from "@/lib/learner";
import { readLocal, removeLocal, STORAGE_KEYS, writeLocal } from "@/lib/storage";
import { emptyHistory, initialProfile, MAX_ANSWER_RECORDS, updateProfileAfterQuiz } from "./adaptive";
import { recordAttempt, type QuizGrade } from "./grading";
import { withInsight } from "./mentor";
import { learningProjectById, matchProject } from "./projects";
import {
  DIFFICULTIES,
  type AnswerRecord,
  type Difficulty,
  type MentorInsight,
  type MentorState,
  type PlanAction,
  type PlanItem,
  type QuizPlan,
  type StageAttempt,
  type JourneyState,
  type Language,
  type LearnerProfile,
  type Level,
  type LearningProjectId,
  type PersonalizedQuiz,
  type ProjectPart,
  type Question,
  type StageHistory,
  type StageProgress,
} from "./types";

const LEVELS: Level[] = ["beginner", "intermediate", "advanced"];
const PLAN_KINDS: QuizPlan["kind"][] = ["first", "retry", "next-stage", "practice"];

export const emptyJourney = (language: Language = "ar"): JourneyState => ({
  version: 1,
  language,
  profile: null,
  entry: null,
  project: null,
  parts: [],
  level: null,
  levelScore: null,
  progress: {},
  mentor: null,
});

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const strings = (value: unknown) =>
  Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
const isDifficulty = (value: unknown): value is Difficulty => DIFFICULTIES.includes(value as Difficulty);

function sanitizeQuestion(raw: unknown): Question | null {
  if (!isRecord(raw)) return null;
  const options = strings(raw["options"]);
  const correct = raw["correct"];
  if (
    typeof raw["id"] !== "string" ||
    typeof raw["skill"] !== "string" ||
    typeof raw["prompt"] !== "string" ||
    typeof raw["explanation"] !== "string" ||
    !isDifficulty(raw["difficulty"]) ||
    options.length !== 4 ||
    !Number.isInteger(correct) ||
    (correct as number) < 0 ||
    (correct as number) > 3
  )
    return null;
  return {
    id: raw["id"],
    skill: raw["skill"],
    difficulty: raw["difficulty"],
    prompt: raw["prompt"],
    options,
    correct: correct as number,
    explanation: raw["explanation"],
  };
}

/** A cached quiz is kept only if every part of it is well-formed; otherwise it is rebuilt. */
function sanitizePending(raw: unknown): PersonalizedQuiz | null {
  if (!isRecord(raw) || !isRecord(raw["plan"])) return null;
  const plan = raw["plan"];
  const questions = Array.isArray(raw["questions"]) ? raw["questions"].map(sanitizeQuestion) : [];
  if (
    typeof raw["id"] !== "string" ||
    typeof raw["stageId"] !== "string" ||
    !Number.isInteger(raw["attempt"]) ||
    (raw["source"] !== "ai" && raw["source"] !== "local") ||
    (raw["language"] !== "ar" && raw["language"] !== "en") ||
    typeof raw["explanation"] !== "string" ||
    typeof raw["practiceTask"] !== "string" ||
    !questions.length ||
    questions.some((q) => !q) ||
    !isDifficulty(plan["difficulty"]) ||
    !["first", "retry", "next-stage", "practice"].includes(plan["kind"] as string)
  )
    return null;
  return {
    id: raw["id"],
    stageId: raw["stageId"],
    attempt: raw["attempt"] as number,
    source: raw["source"],
    ...(typeof raw["fallbackReason"] === "string" ? { fallbackReason: raw["fallbackReason"] as NonNullable<PersonalizedQuiz["fallbackReason"]> } : {}),
    plan: {
      kind: plan["kind"] as PersonalizedQuiz["plan"]["kind"],
      difficulty: plan["difficulty"],
      focusSkills: strings(plan["focusSkills"]),
      reviewSkill: typeof plan["reviewSkill"] === "string" ? plan["reviewSkill"] : null,
      reviewCount: Number.isInteger(plan["reviewCount"]) ? (plan["reviewCount"] as number) : 0,
      raised: plan["raised"] === true,
      easier: plan["easier"] === true,
    },
    language: raw["language"],
    explanation: raw["explanation"],
    practiceTask: raw["practiceTask"],
    questions: questions as Question[],
  };
}

function sanitizeProfile(raw: unknown): LearnerProfile | null {
  if (!isRecord(raw) || !isDifficulty(raw["difficulty"])) return null;
  const mastery: Record<string, number> = {};
  if (isRecord(raw["mastery"]))
    for (const [skill, value] of Object.entries(raw["mastery"]))
      if (typeof value === "number" && Number.isFinite(value)) mastery[skill] = Math.max(0, Math.min(100, value));
  const history: Record<string, StageHistory> = {};
  if (isRecord(raw["history"]))
    for (const [stageId, entry] of Object.entries(raw["history"])) {
      if (!isRecord(entry)) continue;
      history[stageId] = {
        ...emptyHistory(),
        asked: strings(entry["asked"]),
        lastWrongSkills: strings(entry["lastWrongSkills"]),
        wrong: Array.isArray(entry["wrong"])
          ? entry["wrong"].filter(
              (w): w is StageHistory["wrong"][number] =>
                isRecord(w) && ["prompt", "skill", "chosen", "correct"].every((k) => typeof w[k] === "string"),
            )
          : [],
        attempts: Array.isArray(entry["attempts"])
          ? entry["attempts"].flatMap((a): StageAttempt[] =>
              isRecord(a) && typeof a["score"] === "number" && typeof a["quizId"] === "string" && (a["source"] === "ai" || a["source"] === "local")
                ? [
                    {
                      score: a["score"],
                      quizId: a["quizId"],
                      source: a["source"],
                      ...(PLAN_KINDS.includes(a["kind"] as QuizPlan["kind"]) ? { kind: a["kind"] as QuizPlan["kind"] } : {}),
                      ...(typeof a["focusSkill"] === "string" ? { focusSkill: a["focusSkill"] } : {}),
                    },
                  ]
                : [],
            )
          : [],
        pending: sanitizePending(entry["pending"]),
      };
    }
  const baseline = typeof raw["baseline"] === "number" && Number.isFinite(raw["baseline"]) ? raw["baseline"] : 50;
  const answers = Array.isArray(raw["answers"])
    ? raw["answers"].map(sanitizeRecord).filter((r): r is AnswerRecord => r !== null).slice(0, MAX_ANSWER_RECORDS)
    : [];
  return { mastery, baseline, difficulty: raw["difficulty"], history, answers };
}

const isIndex = (value: unknown) => Number.isInteger(value) && (value as number) >= 0 && (value as number) <= 3;

function sanitizeRecord(raw: unknown): AnswerRecord | null {
  if (
    !isRecord(raw) ||
    !["questionId", "stageId", "skill", "prompt", "chosen", "correctAnswer"].every((k) => typeof raw[k] === "string") ||
    !isDifficulty(raw["difficulty"]) ||
    !(raw["chosenIndex"] === null || isIndex(raw["chosenIndex"])) ||
    !isIndex(raw["correctIndex"]) ||
    typeof raw["isCorrect"] !== "boolean" ||
    (raw["source"] !== "ai" && raw["source"] !== "local")
  )
    return null;
  return {
    questionId: raw["questionId"] as string,
    stageId: raw["stageId"] as string,
    skill: raw["skill"] as string,
    difficulty: raw["difficulty"],
    prompt: raw["prompt"] as string,
    chosen: raw["chosen"] as string,
    chosenIndex: raw["chosenIndex"] as number | null,
    correctAnswer: raw["correctAnswer"] as string,
    correctIndex: raw["correctIndex"] as number,
    isCorrect: raw["isCorrect"],
    source: raw["source"],
  };
}

const PLAN_ACTIONS: PlanAction[] = ["keep", "add-remedial", "shorten", "skippable"];
const textOf = (value: unknown) => (typeof value === "string" ? value : "");

function sanitizePlanItems(raw: unknown): PlanItem[] | null {
  if (!Array.isArray(raw)) return null;
  const items: PlanItem[] = [];
  for (const entry of raw) {
    if (
      !isRecord(entry) ||
      (entry["kind"] !== "stage" && entry["kind"] !== "remedial") ||
      typeof entry["target"] !== "string" ||
      !PLAN_ACTIONS.includes(entry["action"] as PlanAction)
    )
      return null;
    items.push({
      kind: entry["kind"],
      target: entry["target"],
      action: entry["action"] as PlanAction,
      reason: textOf(entry["reason"]),
      explanation: textOf(entry["explanation"]),
    });
  }
  return items;
}

/** A cached insight is kept only if it is well-formed; it is checked against the path when shown. */
function sanitizeInsight(raw: unknown): MentorInsight | null {
  if (!isRecord(raw) || !isRecord(raw["diagnosis"]) || !isRecord(raw["plan"])) return null;
  const d = raw["diagnosis"];
  const items = sanitizePlanItems(raw["plan"]["items"]);
  if (
    !items ||
    typeof raw["id"] !== "string" ||
    typeof raw["checkpoint"] !== "string" ||
    (raw["source"] !== "ai" && raw["source"] !== "local") ||
    (raw["language"] !== "ar" && raw["language"] !== "en") ||
    !["low", "medium", "high"].includes(d["confidence"] as string)
  )
    return null;
  return {
    id: raw["id"],
    checkpoint: raw["checkpoint"],
    source: raw["source"],
    ...(typeof raw["fallbackReason"] === "string" ? { fallbackReason: raw["fallbackReason"] as NonNullable<MentorInsight["fallbackReason"]> } : {}),
    language: raw["language"],
    basedOn: typeof raw["basedOn"] === "number" ? raw["basedOn"] : 0,
    diagnosis: {
      summary: textOf(d["summary"]),
      strengths: strings(d["strengths"]),
      weakSkills: strings(d["weakSkills"]),
      misconceptions: Array.isArray(d["misconceptions"])
        ? d["misconceptions"].filter((m): m is { skill: string; text: string } => isRecord(m) && typeof m["skill"] === "string" && typeof m["text"] === "string")
        : [],
      confidence: d["confidence"] as MentorInsight["diagnosis"]["confidence"],
      confidenceNote: textOf(d["confidenceNote"]),
    },
    plan: { items, changeNote: textOf(raw["plan"]["changeNote"]) },
  };
}

function sanitizeMentor(raw: unknown): MentorState | null {
  if (!isRecord(raw) || typeof raw["checkpoint"] !== "string") return null;
  const checkpoint = raw["checkpoint"];
  const insights = (Array.isArray(raw["insights"]) ? raw["insights"].map(sanitizeInsight) : []).filter(
    (i): i is MentorInsight => i !== null && i.checkpoint === checkpoint,
  );
  if (!insights.length) return null;
  const prev = raw["previous"];
  const prevItems = isRecord(prev) ? sanitizePlanItems(prev["items"]) : null;
  return {
    checkpoint,
    insights,
    previous:
      isRecord(prev) && prevItems && typeof prev["checkpoint"] === "string" && (prev["source"] === "ai" || prev["source"] === "local")
        ? { checkpoint: prev["checkpoint"], source: prev["source"], items: prevItems }
        : null,
    // The path applies the order only after checking it against the stages and progress again.
    order: Array.isArray(raw["order"]) && raw["order"].every((id) => typeof id === "string") ? (raw["order"] as string[]) : null,
  };
}

/**
 * Keeps every valid field of a saved journey and drops the rest: unknown part keys, invalid
 * quantities, unknown levels and malformed progress, profile or cached-quiz entries.
 */
export function sanitizeJourney(raw: Record<string, unknown>): JourneyState {
  const state = emptyJourney(raw["language"] === "en" ? "en" : "ar");
  if (raw["entry"] === "idea" || raw["entry"] === "learning") state.entry = raw["entry"];
  const project = raw["project"];
  if (isRecord(project) && typeof project["id"] === "string") {
    const id = project["id"];
    const title = project["title"];
    const known = id === "custom" || learningProjectById(id);
    if (known && isRecord(title) && typeof title["en"] === "string" && typeof title["ar"] === "string")
      state.project = {
        id: id as LearningProjectId | "custom",
        title: { en: title["en"], ar: title["ar"] },
        description: typeof project["description"] === "string" ? project["description"] : "",
      };
  }
  if (Array.isArray(raw["parts"]))
    state.parts = raw["parts"].filter(
      (p): p is ProjectPart =>
        isRecord(p) &&
        typeof p["key"] === "string" &&
        catalogByKey.has(p["key"]) &&
        Number.isInteger(p["quantity"]) &&
        (p["quantity"] as number) > 0,
    );
  if (LEVELS.includes(raw["level"] as Level)) state.level = raw["level"] as Level;
  if (typeof raw["levelScore"] === "number" && Number.isFinite(raw["levelScore"]))
    state.levelScore = raw["levelScore"];
  if (isRecord(raw["progress"]))
    for (const [id, entry] of Object.entries(raw["progress"]))
      if (
        isRecord(entry) &&
        Number.isInteger(entry["attempts"]) &&
        (entry["attempts"] as number) >= 0 &&
        typeof entry["passed"] === "boolean" &&
        typeof entry["bestScore"] === "number"
      )
        state.progress[id] = {
          attempts: entry["attempts"] as number,
          passed: entry["passed"],
          bestScore: entry["bestScore"],
          lastScore: typeof entry["lastScore"] === "number" ? entry["lastScore"] : null,
        } satisfies StageProgress;
  state.profile = sanitizeProfile(raw["profile"]);
  state.mentor = state.level ? sanitizeMentor(raw["mentor"]) : null;
  // A journey that already has a level always gets a profile.
  if (state.level && !state.profile) state.profile = initialProfile(state.level);
  return state;
}

// In-memory copy: the journey keeps working for this session even if storage is blocked.
let memory: JourneyState | null = null;
let migrated = false;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());

/**
 * One-time migration from the removed two-learner demo: Student A's journey is already stored
 * under the main journey key and is kept as is (sanitized on read like any saved journey).
 * Student B's journey and the learner switch setting are removed. Removing never throws, so
 * invalid or partial old data can't break loading.
 */
export function migrateSingleLearner() {
  removeLocal(LEGACY_KEYS.learnerBJourney);
  removeLocal(LEGACY_KEYS.activeLearner);
}

/**
 * Reads the learner's saved journey. Data that isn't a version-1 object is reported as unreadable
 * and left untouched (the storage notice offers a reset); partly invalid data is sanitized.
 */
export function readJourney(): JourneyState {
  if (!memory) {
    if (!migrated) {
      migrated = true;
      migrateSingleLearner();
    }
    const raw = readLocal<unknown>(STORAGE_KEYS.journey, null, (v) => isRecord(v) && v["version"] === 1);
    memory = isRecord(raw) ? sanitizeJourney(raw) : emptyJourney();
  }
  return memory;
}

/** Saves to memory and, when possible, to localStorage. Returns false if storage failed. */
export function saveJourney(next: JourneyState): boolean {
  memory = next;
  notify();
  try {
    writeLocal(STORAGE_KEYS.journey, next);
    return true;
  } catch {
    return false;
  }
}

export const updateJourney = (change: (state: JourneyState) => JourneyState) =>
  saveJourney(change(readJourney()));

/** "Reset demo": clears the journey and the BOM. Lab circuits and the AI demo cache are kept. */
export function resetDemo() {
  removeLocal(STORAGE_KEYS.journey);
  removeLocal(STORAGE_KEYS.bom);
  migrateSingleLearner();
  memory = null;
  notify();
}

/** Drops the in-memory journey so the next read comes from localStorage (a reload, in tests). */
export function reloadJourney() {
  memory = null;
  migrated = false;
  notify();
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
export const useJourney = () => useSyncExternalStore(subscribe, readJourney, readJourney);

/** Idea entry: approved parts from Describe Project; a known project gets its written path. */
export function startIdeaJourney(description: string, parts: ProjectPart[]) {
  const matched = matchProject(description);
  const written = matched ? learningProjectById(matched) : null;
  return saveJourney({
    ...emptyJourney(readJourney().language),
    entry: "idea",
    project: {
      id: written?.id ?? "custom",
      title: written?.title ?? { en: "Your project", ar: "مشروعك" },
      description,
    },
    parts: parts.filter((p) => catalogByKey.has(p.key) && p.quantity > 0),
  });
}

/** Pure: a fresh journey for a learning project. */
export function learningJourney(id: LearningProjectId, language: Language): JourneyState | null {
  const project = learningProjectById(id);
  if (!project) return null;
  return {
    ...emptyJourney(language),
    entry: "learning",
    project: { id: project.id, title: project.title, description: project.summary.en },
    parts: project.parts.map((p) => ({ ...p })),
  };
}

/** Learning entry: a chosen learning project with its own parts list. */
export function startLearningJourney(id: LearningProjectId) {
  const next = learningJourney(id, readJourney().language);
  return next ? saveJourney(next) : false;
}

/** Pure: a level applied to a journey; `difficulty` overrides the level's default (AI level check). */
export const withLevel = (
  state: JourneyState,
  level: Level,
  levelScore: number,
  levelAnswers: (number | null)[] = [],
  difficulty?: Difficulty,
): JourneyState => {
  const profile = initialProfile(level, levelAnswers);
  return {
    ...state,
    level,
    levelScore,
    progress: {},
    profile: difficulty ? { ...profile, difficulty } : profile,
    // A new level check starts a new plan; the first diagnosis is made for it.
    mentor: null,
  };
};

/** Setting a level starts the path over and creates the learner profile from the answers. */
export const setJourneyLevel = (
  level: Level,
  levelScore: number,
  levelAnswers: (number | null)[] = [],
  difficulty?: Difficulty,
) => updateJourney((state) => withLevel(state, level, levelScore, levelAnswers, difficulty));

/** Caches a mentor analysis and plan; a new checkpoint keeps the old plan for "What changed". */
export const saveMentorInsight = (insight: MentorInsight) =>
  updateJourney((state) => ({ ...state, mentor: withInsight(state.mentor, insight) }));

export const setJourneyLanguage = (language: Language) => updateJourney((state) => ({ ...state, language }));

/** Caches a prepared quiz so a reload shows it again without another request. */
export const savePendingQuiz = (quiz: PersonalizedQuiz) =>
  updateJourney((state) => {
    const profile = state.profile ?? initialProfile(state.level ?? "intermediate");
    const history = profile.history[quiz.stageId] ?? emptyHistory();
    return { ...state, profile: { ...profile, history: { ...profile.history, [quiz.stageId]: { ...history, pending: quiz } } } };
  });

/** Pure: a graded quiz applied to a journey (gating progress plus the learner profile). */
export const withQuizResult = (
  state: JourneyState,
  stageId: string,
  quiz: PersonalizedQuiz,
  answers: (number | null)[],
  grade: QuizGrade,
): JourneyState => ({
  ...state,
  progress: recordAttempt(state.progress, stageId, grade),
  profile: updateProfileAfterQuiz(state.profile ?? initialProfile(state.level ?? "intermediate"), stageId, quiz, answers, grade),
});

/** Records a graded quiz: gating progress plus the learner profile (mastery, difficulty, history). */
export const recordQuizResult = (
  stageId: string,
  quiz: PersonalizedQuiz,
  answers: (number | null)[],
  grade: QuizGrade,
) => updateJourney((state) => withQuizResult(state, stageId, quiz, answers, grade));

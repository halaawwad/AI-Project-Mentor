import { useSyncExternalStore } from "react";
import { catalogByKey } from "@/lib/componentCatalog";
import { readLocal, removeLocal, STORAGE_KEYS, writeLocal } from "@/lib/storage";
import { learningProjectById, matchProject } from "./projects";
import type { JourneyState, Level, LearningProjectId, ProjectPart, StageProgress } from "./types";

const KEY = STORAGE_KEYS.journey;
const LEVELS: Level[] = ["beginner", "intermediate", "advanced"];

export const emptyJourney = (): JourneyState => ({
  version: 1,
  entry: null,
  project: null,
  parts: [],
  level: null,
  levelScore: null,
  progress: {},
});

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * Keeps every valid field of a saved journey and drops the rest: unknown part keys, invalid
 * quantities, unknown levels and malformed progress entries.
 */
export function sanitizeJourney(raw: Record<string, unknown>): JourneyState {
  const state = emptyJourney();
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
  return state;
}

// In-memory copy: the journey keeps working for this session even if storage is blocked.
let memory: JourneyState | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());

/**
 * Reads the saved journey. Data that isn't a version-1 object is reported as unreadable and
 * left untouched (the storage notice offers a reset); partly invalid data is sanitized.
 */
export function readJourney(): JourneyState {
  if (!memory) {
    const raw = readLocal<unknown>(KEY, null, (v) => isRecord(v) && v["version"] === 1);
    memory = isRecord(raw) ? sanitizeJourney(raw) : emptyJourney();
  }
  return memory;
}

/** Saves to memory and, when possible, to localStorage. Returns false if storage failed. */
export function saveJourney(next: JourneyState): boolean {
  memory = next;
  notify();
  try {
    writeLocal(KEY, next);
    return true;
  } catch {
    return false;
  }
}

export const updateJourney = (change: (state: JourneyState) => JourneyState) =>
  saveJourney(change(readJourney()));

/** "Reset demo": clears journey progress and the BOM (lab circuits are kept). */
export function resetDemo() {
  removeLocal(KEY);
  removeLocal(STORAGE_KEYS.bom);
  memory = null;
  notify();
}

export function useJourney() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    readJourney,
    readJourney,
  );
}

/** Idea entry: approved parts from Describe Project; a known project gets its written path. */
export function startIdeaJourney(description: string, parts: ProjectPart[]) {
  const matched = matchProject(description);
  const written = matched ? learningProjectById(matched) : null;
  return saveJourney({
    ...emptyJourney(),
    entry: "idea",
    project: {
      id: written?.id ?? "custom",
      title: written?.title ?? { en: "Your project", ar: "مشروعك" },
      description,
    },
    parts: parts.filter((p) => catalogByKey.has(p.key) && p.quantity > 0),
  });
}

/** Learning entry: a chosen learning project with its own parts list. */
export function startLearningJourney(id: LearningProjectId) {
  const project = learningProjectById(id);
  if (!project) return false;
  return saveJourney({
    ...emptyJourney(),
    entry: "learning",
    project: { id: project.id, title: project.title, description: project.summary.en },
    parts: project.parts.map((p) => ({ ...p })),
  });
}

/** Setting a level starts the path over, since the stages can change. */
export const setJourneyLevel = (level: Level, levelScore: number) =>
  updateJourney((state) => ({ ...state, level, levelScore, progress: {} }));

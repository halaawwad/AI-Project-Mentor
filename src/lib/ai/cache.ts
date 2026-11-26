import { useSyncExternalStore } from "react";
import { LEARNER_ID, LEGACY_LEARNER_A, LEGACY_LEARNER_B } from "@/lib/learner";
import { readLocal, removeLocal, STORAGE_KEYS, writeLocal } from "@/lib/storage";
import { isRecord, type Language } from "./shared";

/**
 * Demo cache: every successful (validated) Gemini result, per feature, checkpoint and language
 * for the learner (`LEARNER_ID`). It is separate from the journeys, so it survives reloads and "Reset demo"; only
 * "Clear AI cache" removes it. Each feature validates a cached value again before using it.
 */
export type AiFeature = "level" | "mentor" | "lesson" | "quiz" | "feedback" | "wiring" | "component";
export const AI_FEATURES: AiFeature[] = ["level", "mentor", "lesson", "quiz", "feedback", "wiring", "component"];

export interface AiCacheEntry {
  feature: AiFeature;
  learner: string;
  checkpoint: string;
  language: Language;
  createdAt: number;
  value: unknown;
}

const MAX_ENTRIES = 300;
let memory: Record<string, AiCacheEntry> | null = null;
let version = 0;
const listeners = new Set<() => void>();
const notify = () => {
  version += 1;
  listeners.forEach((listener) => listener());
};

export const aiCacheKey = (learner: string, feature: AiFeature, checkpoint: string, language: Language) =>
  `${learner}|${feature}|${checkpoint}|${language}`;

function sanitize(raw: unknown): Record<string, AiCacheEntry> {
  const entries: Record<string, AiCacheEntry> = {};
  if (!isRecord(raw)) return entries;
  for (const [key, e] of Object.entries(raw))
    if (
      isRecord(e) &&
      AI_FEATURES.includes(e["feature"] as AiFeature) &&
      typeof e["learner"] === "string" &&
      typeof e["checkpoint"] === "string" &&
      (e["language"] === "ar" || e["language"] === "en") &&
      typeof e["createdAt"] === "number" &&
      "value" in e
    )
      entries[key] = {
        feature: e["feature"] as AiFeature,
        learner: e["learner"],
        checkpoint: e["checkpoint"],
        language: e["language"],
        createdAt: e["createdAt"],
        value: e["value"],
      };
  return entries;
}

/**
 * Migration from the removed two-learner demo: Student A's entries become the single learner's
 * (an existing entry for the same checkpoint wins), and Student B's entries are dropped.
 * Returns the migrated entries and whether anything changed.
 */
export function migrateCacheEntries(entries: Record<string, AiCacheEntry>) {
  const out: Record<string, AiCacheEntry> = {};
  let changed = false;
  for (const [key, entry] of Object.entries(entries)) {
    if (entry.learner === LEGACY_LEARNER_B) {
      changed = true;
      continue;
    }
    if (entry.learner === LEGACY_LEARNER_A) {
      changed = true;
      const moved = { ...entry, learner: LEARNER_ID };
      const movedKey = aiCacheKey(LEARNER_ID, entry.feature, entry.checkpoint, entry.language);
      if (!entries[movedKey]) out[movedKey] = moved;
      continue;
    }
    out[key] = entry;
  }
  return { entries: out, changed };
}

function load() {
  if (!memory) {
    const { entries, changed } = migrateCacheEntries(sanitize(readLocal<unknown>(STORAGE_KEYS.aiCache, {}, isRecord)));
    memory = entries;
    if (changed)
      try {
        writeLocal(STORAGE_KEYS.aiCache, entries);
      } catch {
        /* the migrated copy is used for this session; storage stays as it was */
      }
  }
  return memory;
}

export function getAiCache(learner: string, feature: AiFeature, checkpoint: string, language: Language) {
  return load()[aiCacheKey(learner, feature, checkpoint, language)] ?? null;
}

export const hasAiCache = (learner: string, feature: AiFeature, checkpoint: string, language: Language) =>
  getAiCache(learner, feature, checkpoint, language) !== null;

/** Stores a validated result. Storage failures keep it in memory for this session. */
export function putAiCache(entry: Omit<AiCacheEntry, "createdAt">, now = Date.now()) {
  const next = { ...load(), [aiCacheKey(entry.learner, entry.feature, entry.checkpoint, entry.language)]: { ...entry, createdAt: now } };
  const keys = Object.keys(next);
  if (keys.length > MAX_ENTRIES)
    keys
      .sort((a, b) => next[a]!.createdAt - next[b]!.createdAt)
      .slice(0, keys.length - MAX_ENTRIES)
      .forEach((key) => delete next[key]);
  memory = next;
  notify();
  try {
    writeLocal(STORAGE_KEYS.aiCache, next);
    return true;
  } catch {
    return false;
  }
}

export const aiCacheEntries = () => Object.values(load());

/** Explicit "Clear AI cache" (Reset demo keeps it). */
export function clearAiCache() {
  memory = {};
  removeLocal(STORAGE_KEYS.aiCache);
  notify();
}

/** Drops the in-memory copy so the next read comes from localStorage (used after a reload in tests). */
export function reloadAiCache() {
  memory = null;
  notify();
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
/** Re-renders a component whenever the cache changes. */
export const useAiCacheVersion = () => useSyncExternalStore(subscribe, () => version, () => version);

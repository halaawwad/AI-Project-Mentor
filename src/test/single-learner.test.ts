import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { aiCacheEntries, aiCacheKey, clearAiCache, getAiCache, migrateCacheEntries, putAiCache, reloadAiCache, type AiCacheEntry } from "../lib/ai/cache";
import { levelQuestions } from "../lib/journey/level";
import { assessLevel } from "../lib/journey/levelAi";
import { readJourney, reloadJourney, resetDemo, setJourneyLevel, startLearningJourney } from "../lib/journey/store";
import { LEARNER_ID, LEGACY_KEYS } from "../lib/learner";
import type { AiClient } from "../lib/suggest/aiEngine";
import { currentStorageFailure, STORAGE_KEYS, unreadableKeys } from "../lib/storage";

const allCorrect = levelQuestions.map((q) => q.correct);
const entry = (learner: string, checkpoint: string, value: unknown = { level: "intermediate" }): AiCacheEntry => ({
  feature: "level",
  learner,
  checkpoint,
  language: "ar",
  createdAt: 1,
  value,
});
const keyed = (...entries: AiCacheEntry[]) =>
  Object.fromEntries(entries.map((e) => [aiCacheKey(e.learner, e.feature, e.checkpoint, e.language), e]));

beforeEach(() => {
  localStorage.clear();
  resetDemo();
  clearAiCache();
  vi.stubGlobal("fetch", vi.fn(() => { throw new Error("Network access is disabled in tests"); }));
});
afterEach(() => vi.unstubAllGlobals());

describe("migration to a single learner", () => {
  it("keeps Student A's journey, profile and answer records, and removes Student B's data", () => {
    startLearningJourney("traffic-light");
    setJourneyLevel("intermediate", 3, allCorrect);
    const studentA = localStorage.getItem(STORAGE_KEYS.journey)!;
    // Old two-learner data: B's journey and B as the active learner.
    localStorage.setItem(LEGACY_KEYS.learnerBJourney, JSON.stringify({ ...JSON.parse(studentA), project: { id: "parking-sensor", title: { en: "P", ar: "ب" }, description: "" } }));
    localStorage.setItem(LEGACY_KEYS.activeLearner, JSON.stringify("b"));
    reloadJourney();
    const journey = readJourney();
    expect(journey.project!.id).toBe("traffic-light");
    expect(journey.profile!.answers).toHaveLength(3);
    expect(localStorage.getItem(LEGACY_KEYS.learnerBJourney)).toBeNull();
    expect(localStorage.getItem(LEGACY_KEYS.activeLearner)).toBeNull();
    expect(localStorage.getItem(STORAGE_KEYS.journey)).toBe(studentA);
  });

  it("handles invalid or partial old data without crashing", () => {
    // Partial Student A data is sanitized; garbage in the removed keys is simply deleted.
    localStorage.setItem(STORAGE_KEYS.journey, JSON.stringify({ version: 1, level: "beginner", profile: { difficulty: "easy", answers: [{ bad: true }] }, progress: { x: "nope" } }));
    localStorage.setItem(LEGACY_KEYS.learnerBJourney, "{not json");
    localStorage.setItem(LEGACY_KEYS.activeLearner, "42");
    reloadJourney();
    const journey = readJourney();
    expect(journey.level).toBe("beginner");
    expect(journey.profile!.answers).toEqual([]);
    expect(journey.progress).toEqual({});
    expect(localStorage.getItem(LEGACY_KEYS.learnerBJourney)).toBeNull();
    expect(localStorage.getItem(LEGACY_KEYS.activeLearner)).toBeNull();
  });

  it("leaves an unreadable journey untouched and reports it", () => {
    localStorage.setItem(STORAGE_KEYS.journey, "{broken");
    localStorage.setItem(LEGACY_KEYS.learnerBJourney, JSON.stringify({ version: 1 }));
    reloadJourney();
    expect(readJourney().project).toBeNull();
    expect(localStorage.getItem(STORAGE_KEYS.journey)).toBe("{broken");
    expect(unreadableKeys()).toContain(STORAGE_KEYS.journey);
    expect(currentStorageFailure()).not.toBe("");
    expect(localStorage.getItem(LEGACY_KEYS.learnerBJourney)).toBeNull();
  });

  it("moves Student A's AI cache to the learner and drops Student B's", () => {
    const old = keyed(entry("a", "placement:1-000"), entry("b", "placement:1-100"), entry("a", "placement:2-000"), entry(LEARNER_ID, "placement:2-000", { level: "advanced" }));
    const { entries, changed } = migrateCacheEntries(old);
    expect(changed).toBe(true);
    expect(Object.values(entries).map((e) => [e.learner, e.checkpoint]).sort()).toEqual([
      [LEARNER_ID, "placement:1-000"],
      [LEARNER_ID, "placement:2-000"],
    ]);
    // An existing learner entry for the same checkpoint wins over the migrated one.
    expect(entries[aiCacheKey(LEARNER_ID, "level", "placement:2-000", "ar")]!.value).toEqual({ level: "advanced" });
    expect(migrateCacheEntries(entries).changed).toBe(false);
  });

  it("migrates the stored AI cache on load and writes it back once", () => {
    localStorage.setItem(STORAGE_KEYS.aiCache, JSON.stringify(keyed(entry("a", "placement:1-000"), entry("b", "placement:1-100"))));
    reloadAiCache();
    expect(aiCacheEntries().map((e) => e.learner)).toEqual([LEARNER_ID]);
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEYS.aiCache)!) as Record<string, AiCacheEntry>;
    expect(Object.values(stored).map((e) => e.learner)).toEqual([LEARNER_ID]);
    expect(getAiCache(LEARNER_ID, "level", "placement:1-000", "ar")).not.toBeNull();
    // Unreadable cache data is left as it is.
    localStorage.setItem(STORAGE_KEYS.aiCache, "[oops");
    reloadAiCache();
    expect(aiCacheEntries()).toEqual([]);
    expect(localStorage.getItem(STORAGE_KEYS.aiCache)).toBe("[oops");
  });
});

describe("single-learner AI cache", () => {
  const ctx = { rating: 1, answers: allCorrect, language: "ar" as const };
  const failing = { models: { generateContent: vi.fn(async () => { throw new Error("must not be called"); }) } } as unknown as AiClient;

  it("reuses a migrated Student A result for the learner (validated again), without a request", async () => {
    // A level assessment Student A got before the change, for the same answers.
    localStorage.setItem(
      STORAGE_KEYS.aiCache,
      JSON.stringify(keyed({ ...entry("a", "placement:1-210"), value: { level: "intermediate", difficulty: "medium", reason: "إجاباتك صحيحة ومناسبة للمستوى المتوسط." } })),
    );
    reloadAiCache();
    const result = await assessLevel({ learnerId: LEARNER_ID, ...ctx, answers: [2, 1, 0], config: { apiKey: "k", model: "gemini-3.6-flash", timeoutMs: 1000 }, client: failing });
    expect(result).toMatchObject({ source: "ai", level: "intermediate" });
  });

  it("doesn't reuse a cached result that no longer validates", async () => {
    putAiCache({ feature: "level", learner: LEARNER_ID, checkpoint: "placement:1-000", language: "ar", value: { level: "expert" } });
    const result = await assessLevel({ learnerId: LEARNER_ID, ...ctx, answers: [0, 0, 0], config: { apiKey: "", model: "m", timeoutMs: 1000 } });
    expect(result).toMatchObject({ source: "local", fallbackReason: "missing-key" });
  });

  it("Reset demo keeps the cache; Clear AI cache removes it", () => {
    putAiCache({ feature: "level", learner: LEARNER_ID, checkpoint: "placement:x", language: "ar", value: {} });
    resetDemo();
    reloadAiCache();
    expect(aiCacheEntries()).toHaveLength(1);
    clearAiCache();
    expect(aiCacheEntries()).toHaveLength(0);
  });
});

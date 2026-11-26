import { beforeEach, describe, expect, it } from "vitest";
import { catalogByKey } from "../lib/componentCatalog";
import { buildGenericPath } from "../lib/journey/generic";
import {
  allPassed,
  gradeQuiz,
  mentorFeedback,
  recordAttempt,
  stageStatuses,
} from "../lib/journey/grading";
import { levelQuestions, scoreLevel } from "../lib/journey/level";
import { buildPath } from "../lib/journey/path";
import { basics, learningProjectById, learningProjects, matchProject } from "../lib/journey/projects";
import {
  readJourney,
  resetDemo,
  saveJourney,
  startIdeaJourney,
  startLearningJourney,
  setJourneyLevel,
} from "../lib/journey/store";
import type { Quiz, Stage } from "../lib/journey/types";
import { currentStorageFailure, STORAGE_KEYS, unreadableKeys } from "../lib/storage";

const correctAnswers = (quiz: Quiz) => quiz.questions.map((q) => q.correct);
const wrong = (q: Quiz["questions"][number]) => (q.correct + 1) % q.options.length;
const allQuizzes = (stages: Stage[]) => stages.flatMap((stage) => stage.quizzes);

function expectWellFormed(stages: Stage[]) {
  for (const stage of stages) {
    expect(stage.parts.length).toBeGreaterThan(0);
    for (const key of stage.parts) expect(catalogByKey.has(key)).toBe(true);
    for (const quiz of stage.quizzes) {
      expect(quiz.questions.length).toBeGreaterThanOrEqual(3);
      expect(quiz.questions.length).toBeLessThanOrEqual(5);
      for (const q of quiz.questions) {
        expect(new Set(q.options).size).toBe(q.options.length);
        expect(q.correct).toBeGreaterThanOrEqual(0);
        expect(q.correct).toBeLessThan(q.options.length);
        expect(q.explanation.length).toBeGreaterThan(0);
      }
    }
    expect(stage.quizzes[0].id).not.toBe(stage.quizzes[1].id);
  }
}

beforeEach(() => {
  localStorage.clear();
  resetDemo();
});

describe("written content", () => {
  it("has three complete learning projects plus a basics stage", () => {
    expect(learningProjects.map((p) => p.id)).toEqual(["traffic-light", "parking-sensor", "irrigation"]);
    for (const project of learningProjects) {
      for (const part of project.parts) expect(catalogByKey.has(part.key)).toBe(true);
      expectWellFormed(project.stages);
    }
    expectWellFormed([basics]);
  });

  it("doesn't always put the correct answer in the same position", () => {
    const positions = new Set(allQuizzes(learningProjects.flatMap((p) => p.stages)).flatMap((q) => q.questions.map((x) => x.correct)));
    expect(positions.size).toBeGreaterThan(2);
  });

  it("matches descriptions to written paths by whole words", () => {
    expect(matchProject("Automatic plant watering using soil moisture")).toBe("irrigation");
    expect(matchProject("نظام ري تلقائي حسب رطوبة التربة")).toBe("irrigation");
    expect(matchProject("A traffic light with a pedestrian button")).toBe("traffic-light");
    expect(matchProject("حساس ركن للسيارة مع جرس")).toBe("parking-sensor");
    // "ري" must not match inside "ريليه" (relay).
    expect(matchProject("تشغيل مصباح عبر ريليه")).toBeNull();
    expect(matchProject("A weather station with Wi-Fi")).toBeNull();
  });
});

describe("level routing", () => {
  const answers = (n: number) => levelQuestions.map((q, i) => (i < n ? q.correct : wrong(q)));

  it("maps self-rating plus quick questions to a level", () => {
    expect(scoreLevel(0, answers(0)).level).toBe("beginner");
    expect(scoreLevel(0, answers(2)).level).toBe("beginner");
    expect(scoreLevel(1, answers(2)).level).toBe("intermediate");
    expect(scoreLevel(2, answers(2)).level).toBe("intermediate");
    expect(scoreLevel(2, answers(3)).level).toBe("advanced");
    expect(scoreLevel(2, answers(3)).score).toBe(5);
  });

  it("adds the basics stage only for beginners", () => {
    const base = { project: { id: "traffic-light" as const, title: { en: "", ar: "" }, description: "" }, parts: [] };
    const beginner = buildPath({ ...base, level: "beginner" });
    const intermediate = buildPath({ ...base, level: "intermediate" });
    expect(beginner[0]!.id).toBe("basics");
    expect(beginner).toHaveLength(intermediate.length + 1);
    expect(intermediate.map((s) => s.id)).toEqual(learningProjectById("traffic-light")!.stages.map((s) => s.id));
    expect(buildPath({ ...base, level: null })).toEqual([]);
  });
});

describe("grading and gating", () => {
  const stages = learningProjectById("parking-sensor")!.stages;

  it("passes at 80%: 4 of 5 passes, 3 of 5 fails", () => {
    const quiz = stages[0]!.quizzes[0];
    const four = correctAnswers(quiz).map((a, i) => (i === 0 ? wrong(quiz.questions[0]!) : a));
    const three = four.map((a, i) => (i === 1 ? wrong(quiz.questions[1]!) : a));
    expect(gradeQuiz(quiz, four)).toMatchObject({ correct: 4, score: 80, passed: true });
    expect(gradeQuiz(quiz, three)).toMatchObject({ correct: 3, score: 60, passed: false });
    expect(gradeQuiz(quiz, [null, null, null, null, null]).passed).toBe(false);
  });

  it("keeps the next stage locked until the current one is passed", () => {
    let progress = {};
    expect(stageStatuses(stages, progress)).toEqual(["current", "locked", "locked"]);
    progress = recordAttempt(progress, stages[0]!.id, { score: 60, passed: false });
    expect(stageStatuses(stages, progress)).toEqual(["current", "locked", "locked"]);
    progress = recordAttempt(progress, stages[0]!.id, { score: 100, passed: true });
    expect(stageStatuses(stages, progress)).toEqual(["passed", "current", "locked"]);
    expect(allPassed(stages, progress)).toBe(false);
    for (const stage of stages.slice(1)) progress = recordAttempt(progress, stage.id, { score: 80, passed: true });
    expect(allPassed(stages, progress)).toBe(true);
  });

  it("records attempts, best score, and keeps a pass after a later lower score", () => {
    let progress = recordAttempt({}, "s", { score: 40, passed: false });
    progress = recordAttempt(progress, "s", { score: 100, passed: true });
    progress = recordAttempt(progress, "s", { score: 60, passed: false });
    expect(progress["s"]).toEqual({ attempts: 3, passed: true, bestScore: 100, lastScore: 60 });
  });
});

describe("failed-quiz flow", () => {
  const stage = learningProjectById("traffic-light")!.stages[0]!;

  it("gives strengths, weak points, an alternative explanation and a practice task", () => {
    const quiz = stage.quizzes[0];
    const answers = correctAnswers(quiz).map((a, i) => (i < 2 ? wrong(quiz.questions[i]!) : a));
    const grade = gradeQuiz(quiz, answers);
    expect(grade.passed).toBe(false);
    const feedback = mentorFeedback(stage, quiz, grade);
    const missed = new Set(quiz.questions.slice(0, 2).map((q) => q.skill));
    expect(feedback.weakPoints.sort()).toEqual([...missed].sort());
    for (const skill of feedback.strengths) expect(missed.has(skill)).toBe(false);
    expect(feedback.strengths.length).toBeGreaterThan(0);
    expect(feedback.alternative).toBe(stage.mentor.alternative);
    expect(feedback.practiceTask).toContain("3D Lab");
  });

  // Phase 5 replaced the fixed A/B alternation with adaptive quizzes (see personalize.test.ts);
  // the bank still holds both written versions.
  it("keeps both written quiz versions in the stage's question bank", () => {
    const prompts = (quiz: Quiz) => quiz.questions.map((q) => q.prompt);
    expect(prompts(stage.quizzes[1])).not.toEqual(prompts(stage.quizzes[0]));
    const bank = new Set(stage.bank.map((q) => q.prompt));
    for (const q of [...stage.quizzes[0].questions, ...stage.quizzes[1].questions]) expect(bank.has(q.prompt)).toBe(true);
  });
});

describe("generic path generation", () => {
  const parts = [
    { key: "esp32_devkit_v1", quantity: 1 },
    { key: "dht22", quantity: 1 },
    { key: "oled_096", quantity: 1 },
    { key: "relay_5v", quantity: 1 },
    { key: "unknown_part", quantity: 1 },
  ];

  it("builds grouped stages from the approved parts with valid quizzes", () => {
    const stages = buildGenericPath(parts);
    // relay_5v is in the catalog's "Power drivers" category, so it gets its own stage.
    expect(stages.map((s) => s.id)).toEqual([
      "generic-controller",
      "generic-inputs",
      "generic-outputs",
      "generic-power",
      "generic-together",
    ]);
    expect(stages.every((s) => s.source === "generated")).toBe(true);
    expectWellFormed(stages);
    for (const stage of stages) for (const quiz of stage.quizzes) expect(quiz.questions).toHaveLength(5);
    expect(stages.at(-1)!.parts).toEqual(["esp32_devkit_v1", "dht22", "oled_096", "relay_5v"]);
    expect(stages[1]!.explanation).toContain("DHT22");
  });

  it("is deterministic and gives two different quiz versions", () => {
    const a = buildGenericPath(parts);
    const b = buildGenericPath(parts);
    expect(a).toEqual(b);
    for (const stage of a)
      expect(stage.quizzes[0].questions.map((q) => q.prompt)).not.toEqual(stage.quizzes[1].questions.map((q) => q.prompt));
  });

  it("returns no stages without known parts, and is used for unmatched projects", () => {
    expect(buildGenericPath([{ key: "nope", quantity: 1 }])).toEqual([]);
    startIdeaJourney("A weather station with Wi-Fi", parts);
    const state = readJourney();
    expect(state.project!.id).toBe("custom");
    expect(state.parts.map((p) => p.key)).not.toContain("unknown_part");
    setJourneyLevel("beginner", 1);
    const path = buildPath(readJourney());
    expect(path[0]!.id).toBe("basics");
    expect(path[1]!.id).toBe("generic-controller");
  });
});

describe("journey storage", () => {
  it("persists under an AiPM key and restores after a reload", () => {
    startLearningJourney("parking-sensor");
    setJourneyLevel("intermediate", 3);
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEYS.journey)!);
    expect(STORAGE_KEYS.journey).toBe("aipm.journey.v1");
    expect(saved).toMatchObject({ version: 1, entry: "learning", level: "intermediate" });
    saveJourney({ ...readJourney(), progress: { "parking-distance": { attempts: 1, passed: true, bestScore: 100, lastScore: 100 } } });
    // Simulate a reload: drop the in-memory copy, keep localStorage.
    const raw = localStorage.getItem(STORAGE_KEYS.journey)!;
    resetDemo();
    localStorage.setItem(STORAGE_KEYS.journey, raw);
    expect(readJourney().progress["parking-distance"]!.passed).toBe(true);
  });

  it("recovers from corrupt data without overwriting it until the demo is reset", () => {
    localStorage.setItem(STORAGE_KEYS.journey, "{not json");
    const state = readJourney();
    expect(state.project).toBeNull();
    expect(unreadableKeys()).toContain(STORAGE_KEYS.journey);
    expect(currentStorageFailure()).not.toBe("");
    // The journey still works in memory, but the unreadable data is left untouched.
    expect(startLearningJourney("traffic-light")).toBe(false);
    expect(readJourney().project!.id).toBe("traffic-light");
    expect(localStorage.getItem(STORAGE_KEYS.journey)).toBe("{not json");
    resetDemo();
    expect(localStorage.getItem(STORAGE_KEYS.journey)).toBeNull();
    expect(unreadableKeys()).not.toContain(STORAGE_KEYS.journey);
    expect(startLearningJourney("traffic-light")).toBe(true);
  });

  it("sanitizes partly invalid saved data", () => {
    localStorage.setItem(
      STORAGE_KEYS.journey,
      JSON.stringify({
        version: 1,
        entry: "hacked",
        project: { id: "irrigation", title: { en: "Automatic irrigation", ar: "ري" }, description: "x" },
        parts: [{ key: "arduino_uno", quantity: 1 }, { key: "fake", quantity: 2 }, { key: "relay_5v", quantity: -1 }],
        level: "wizard",
        levelScore: 3,
        progress: { "irrigation-sensor": { attempts: 2, passed: true, bestScore: 100, lastScore: 100 }, bad: { attempts: "x" } },
      }),
    );
    const state = readJourney();
    expect(state.entry).toBeNull();
    expect(state.project!.id).toBe("irrigation");
    expect(state.parts).toEqual([{ key: "arduino_uno", quantity: 1 }]);
    expect(state.level).toBeNull();
    expect(Object.keys(state.progress)).toEqual(["irrigation-sensor"]);
  });

  it("Reset demo clears the journey and the BOM", () => {
    startLearningJourney("traffic-light");
    localStorage.setItem(STORAGE_KEYS.bom, JSON.stringify([{ key: "arduino_uno", quantity: 1 }]));
    resetDemo();
    expect(localStorage.getItem(STORAGE_KEYS.journey)).toBeNull();
    expect(localStorage.getItem(STORAGE_KEYS.bom)).toBeNull();
    expect(readJourney().project).toBeNull();
  });
});

import { ApiError, type GenerateContentParameters } from "@google/genai";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildLocalQuiz,
  initialProfile,
  planNextQuiz,
  promptKey,
  stageSkills,
  updateProfileAfterQuiz,
} from "../lib/journey/adaptive";
import { allowedSkills, buildQuizSchema, validateGeneratedQuiz, type AiQuizContext } from "../lib/journey/aiQuiz";
import { gradeQuiz } from "../lib/journey/grading";
import { levelQuestions } from "../lib/journey/level";
import { buildPath } from "../lib/journey/path";
import { cachedQuiz, preparePersonalizedQuiz } from "../lib/journey/personalize";
import {
  readJourney,
  recordQuizResult,
  resetDemo,
  savePendingQuiz,
  setJourneyLanguage,
  setJourneyLevel,
  startLearningJourney,
  switchLearner,
} from "../lib/journey/store";
import type { LearnerProfile, PersonalizedQuiz, Question, QuizPlan, Stage } from "../lib/journey/types";
import type { AiClient } from "../lib/suggest/aiEngine";
import type { AiConfig } from "../lib/suggest/config";
import { STORAGE_KEYS } from "../lib/storage";

const config: AiConfig = { apiKey: "test-key", model: "gemini-3.5-flash", timeoutMs: 5_000 };
const noKey: AiConfig = { ...config, apiKey: "" };
const allCorrect = levelQuestions.map((q) => q.correct);

/** Answers that get exactly the questions on `wrongSkills` (or the listed indexes) wrong. */
const answer = (quiz: { questions: Question[] }, wrong: (q: Question, i: number) => boolean) =>
  quiz.questions.map((q, i) => (wrong(q, i) ? (q.correct + 1) % 4 : q.correct));

function setup(project: "traffic-light" | "parking-sensor" = "traffic-light") {
  startLearningJourney(project);
  setJourneyLevel("intermediate", 3, allCorrect);
  const state = readJourney();
  return { state, stages: buildPath(state) };
}

function fakeClient(generate: (params: GenerateContentParameters) => Promise<unknown>) {
  const spy = vi.fn(generate);
  return { client: { models: { generateContent: spy } } as unknown as AiClient, spy };
}
const response = (body: unknown, finishReason = "STOP") => {
  const text = typeof body === "string" ? body : JSON.stringify(body);
  return { text, candidates: [{ finishReason, content: { role: "model", parts: [{ text }] } }] };
};

/** A valid Gemini quiz for the plan: 2 questions on focus skills, review if planned, rest allowed skills. */
function aiBody(ctx: Pick<AiQuizContext, "stage" | "plan">, overrides: (qs: Record<string, unknown>[]) => void = () => {}) {
  const skills = allowedSkills(ctx);
  const focus = ctx.plan.focusSkills;
  const order = [focus[0] ?? skills[0]!, focus[1] ?? focus[0] ?? skills[0]!, ...(ctx.plan.reviewSkill ? [ctx.plan.reviewSkill] : []), ...skills];
  const questions: Record<string, unknown>[] = order.slice(0, 5).map((skill, i) => ({
    prompt: `سؤال مخصص رقم ${i + 1} عن ${skill} (GND)`,
    options: [`خيار A${i}`, `خيار B${i}`, `خيار C${i}`, `خيار D${i}`],
    correctIndex: i % 4,
    explanation: `شرح ${i + 1}`,
    skill,
    difficulty: ctx.plan.difficulty,
  }));
  overrides(questions);
  return {
    explanation: "شرح مخصص لنقاط ضعفك: المقاومة تحد من التيار، وGND هو مسار العودة.",
    practiceTask: "في 3D Lab، وصّل D9 بمقاومة 220 Ω ثم بالـ LED.",
    questions,
  };
}

beforeEach(() => {
  localStorage.clear();
  resetDemo();
  vi.stubGlobal(
    "fetch",
    vi.fn(() => {
      throw new Error("Network access is disabled in tests");
    }),
  );
});
afterEach(() => vi.unstubAllGlobals());

describe("learner profile", () => {
  it("starts from the level check: difficulty from the level, mastery from its answers", () => {
    const answers = levelQuestions.map((q, i) => (i === 0 ? (q.correct + 1) % 4 : q.correct));
    const profile = initialProfile("beginner", answers);
    expect(profile.difficulty).toBe("easy");
    expect(profile.baseline).toBe(30);
    expect(profile.mastery[levelQuestions[0]!.skill]).toBe(15);
    expect(profile.mastery[levelQuestions[1]!.skill]).toBe(45);
    expect(initialProfile("advanced").difficulty).toBe("hard");
  });

  it("updates mastery from skill tags and records history after every quiz", () => {
    const { stages } = setup();
    const stage = stages[0]!;
    const profile = initialProfile("intermediate");
    const quiz = { id: "q1", source: "local" as const, questions: stage.bank.slice(0, 5) };
    const answers = answer(quiz, (_, i) => i === 0);
    const grade = gradeQuiz(quiz, answers);
    const next = updateProfileAfterQuiz(profile, stage.id, quiz, answers, grade);
    const wrongQ = quiz.questions[0]!;
    const rightQ = quiz.questions.find((q, i) => i > 0 && q.skill !== wrongQ.skill)!;
    expect(next.mastery[wrongQ.skill]!).toBeLessThan(50);
    expect(next.mastery[rightQ.skill]!).toBeGreaterThan(50);
    const history = next.history[stage.id]!;
    expect(history.asked).toHaveLength(5);
    expect(history.wrong[0]).toMatchObject({ prompt: wrongQ.prompt, skill: wrongQ.skill, correct: wrongQ.options[wrongQ.correct] });
    expect(history.lastWrongSkills).toEqual([wrongQ.skill]);
    expect(history.attempts).toEqual([{ score: 80, quizId: "q1", source: "local" }]);
    expect(history.pending).toBeNull();
  });
});

describe("adaptive rules", () => {
  it("after a fail: focuses on the missed skills, easier below 50%, same difficulty at 50–79%", () => {
    const { state, stages } = setup();
    const first = buildLocalQuiz(stages, 0, planNextQuiz(stages, 0, state.profile!, {}), state.profile!, "a", "ar");
    const target = first.questions[0]!.skill;
    // 3 wrong (40%): difficulty goes down one step.
    const low = answer(first, (_, i) => i < 3);
    recordQuizResult(stages[0]!.id, first, low, gradeQuiz(first, low));
    let current = readJourney();
    expect(current.profile!.difficulty).toBe("easy");
    const plan = planNextQuiz(stages, 0, current.profile!, current.progress);
    expect(plan.kind).toBe("retry");
    expect(plan.easier).toBe(true);
    expect(plan.focusSkills).toContain(target);
    const retry = buildLocalQuiz(stages, 0, plan, current.profile!, "a", "ar");
    expect(retry.questions.filter((q) => plan.focusSkills.includes(q.skill)).length).toBeGreaterThanOrEqual(2);

    // 2 wrong (60%): difficulty stays.
    const mid = answer(retry, (_, i) => i < 2);
    recordQuizResult(stages[0]!.id, retry, mid, gradeQuiz(retry, mid));
    current = readJourney();
    expect(current.profile!.difficulty).toBe("easy");
    expect(planNextQuiz(stages, 0, current.profile!, current.progress).easier).toBe(false);
  });

  it("after passing with 80–99%: the next stage's first quiz reviews the weakest skill", () => {
    const { state, stages } = setup();
    const quiz = buildLocalQuiz(stages, 0, planNextQuiz(stages, 0, state.profile!, {}), state.profile!, "a", "ar");
    const answers = answer(quiz, (_, i) => i === 0);
    recordQuizResult(stages[0]!.id, quiz, answers, gradeQuiz(quiz, answers));
    const current = readJourney();
    expect(current.progress[stages[0]!.id]!.passed).toBe(true);
    const plan = planNextQuiz(stages, 1, current.profile!, current.progress);
    expect(plan.kind).toBe("next-stage");
    expect(plan.reviewSkill).toBe(quiz.questions[0]!.skill);
    expect([1, 2]).toContain(plan.reviewCount);
    const next = buildLocalQuiz(stages, 1, plan, current.profile!, "a", "ar");
    const review = next.questions.filter((q) => q.skill === plan.reviewSkill);
    expect(review).toHaveLength(plan.reviewCount);
    expect(next.questions).toHaveLength(5);
  });

  it("after 100% on the first attempt: difficulty goes up for the next stage, with no review", () => {
    const { state, stages } = setup();
    const quiz = buildLocalQuiz(stages, 0, planNextQuiz(stages, 0, state.profile!, {}), state.profile!, "a", "ar");
    const answers = answer(quiz, () => false);
    recordQuizResult(stages[0]!.id, quiz, answers, gradeQuiz(quiz, answers));
    const current = readJourney();
    expect(current.profile!.difficulty).toBe("hard");
    const plan = planNextQuiz(stages, 1, current.profile!, current.progress);
    expect(plan).toMatchObject({ kind: "next-stage", raised: true, reviewSkill: null, difficulty: "hard" });
  });

  it("never repeats a question in the same stage while alternatives exist", () => {
    const { stages } = setup();
    let profile: LearnerProfile = initialProfile("intermediate");
    const stage = stages[0]!;
    const seen = new Set<string>();
    const progress = {};
    // 14 bank questions: the first two retries must be entirely new (5 + 5 + 4 new, then repeats).
    for (let attempt = 0; attempt < 3; attempt++) {
      const quiz = buildLocalQuiz(stages, 0, planNextQuiz(stages, 0, profile, progress), profile, "a", "en");
      const keys = quiz.questions.map((q) => promptKey(q.prompt));
      expect(quiz.questions).toHaveLength(5);
      expect(new Set(keys).size).toBe(5);
      const fresh = keys.filter((k) => !seen.has(k)).length;
      expect(fresh).toBe(Math.min(5, stage.bank.length - seen.size));
      keys.forEach((k) => seen.add(k));
      const answers = answer(quiz, (_, i) => i < 3);
      profile = updateProfileAfterQuiz(profile, stage.id, quiz, answers, gradeQuiz(quiz, answers));
    }
  });

  it("gives two learners different next quizzes on the same stage", () => {
    const { stages } = setup();
    const stage = stages[0]!;
    const first = buildLocalQuiz(stages, 0, planNextQuiz(stages, 0, initialProfile("intermediate", allCorrect), {}), initialProfile("intermediate", allCorrect), "a", "en");
    const skills = [...new Set(first.questions.map((q) => q.skill))];
    expect(skills.length).toBeGreaterThan(1);
    const nextFor = (learner: string, missed: string) => {
      const profile = initialProfile("intermediate", allCorrect);
      const answers = answer(first, (q) => q.skill === missed);
      const updated = updateProfileAfterQuiz(profile, stage.id, first, answers, gradeQuiz(first, answers));
      const plan = planNextQuiz(stages, 0, updated, { [stage.id]: { attempts: 1, passed: false, bestScore: 0, lastScore: 0 } });
      return buildLocalQuiz(stages, 0, plan, updated, learner, "en");
    };
    const a = nextFor("a", skills[0]!);
    const b = nextFor("b", skills[1]!);
    expect(a.plan.focusSkills[0]).toBe(skills[0]);
    expect(b.plan.focusSkills[0]).toBe(skills[1]);
    expect(a.questions.map((q) => q.id)).not.toEqual(b.questions.map((q) => q.id));
    expect(a.explanation).not.toBe(b.explanation);
  });
});

describe("Gemini quiz generation", () => {
  const ctxFor = (state = readJourney(), stages: Stage[] = buildPath(state), index = 0): AiQuizContext => ({
    stage: stages[index]!,
    plan: planNextQuiz(stages, index, state.profile!, state.progress),
    profile: state.profile!,
    language: state.language,
    projectParts: state.parts.map((p) => p.key),
  });

  it("uses a valid Gemini quiz and sends stage, parts, profile and asked questions", async () => {
    const { state, stages } = setup();
    const ctx = ctxFor(state, stages);
    const { client, spy } = fakeClient(async () => response(aiBody(ctx)));
    const quiz = await preparePersonalizedQuiz({ state, stages, index: 0, learnerId: "a", config, client });
    expect(quiz.source).toBe("ai");
    expect(quiz.fallbackReason).toBeUndefined();
    expect(quiz.questions).toHaveLength(5);
    expect(quiz.explanation).toContain("شرح مخصص");
    expect(spy).toHaveBeenCalledTimes(1);
    const [params] = spy.mock.calls[0]!;
    const contents = String(params.contents);
    expect(contents).toContain(stages[0]!.goal);
    expect(contents).toContain("ANODE (passive)");
    expect(contents).toContain("Mastery (0–100)");
    expect(String(params.config?.systemInstruction)).toContain("keep technical terms");
    expect(params.config?.responseMimeType).toBe("application/json");
    expect(params.config?.responseJsonSchema).toEqual(buildQuizSchema(ctx));
    expect(params.config?.httpOptions?.retryOptions).toBeUndefined();
    expect(JSON.stringify(params)).not.toContain("test-key");
  });

  it("includes the already-asked questions and recent wrong answers in the request", async () => {
    const { state, stages } = setup();
    const first = buildLocalQuiz(stages, 0, planNextQuiz(stages, 0, state.profile!, {}), state.profile!, "a", "ar");
    const answers = answer(first, (_, i) => i < 3);
    recordQuizResult(stages[0]!.id, first, answers, gradeQuiz(first, answers));
    const current = readJourney();
    const { client, spy } = fakeClient(async () => response(aiBody(ctxFor(current, stages))));
    const quiz = await preparePersonalizedQuiz({ state: current, stages, index: 0, learnerId: "a", config, client });
    expect(quiz.source).toBe("ai");
    const contents = String(spy.mock.calls[0]![0].contents);
    for (const q of first.questions) expect(contents).toContain(promptKey(q.prompt));
    expect(contents).toContain(first.questions[0]!.prompt);
  });

  it.each<[string, (qs: Record<string, unknown>[], ctx: AiQuizContext) => void]>([
    ["only 3 options", (qs) => (qs[0]!["options"] = ["a", "b", "c"])],
    ["duplicate options", (qs) => (qs[0]!["options"] = ["a", "a", "b", "c"])],
    ["correct index out of range", (qs) => (qs[0]!["correctIndex"] = 4)],
    ["unknown skill tag", (qs) => (qs[0]!["skill"] = "Quantum tunnelling")],
    ["unknown difficulty", (qs) => (qs[0]!["difficulty"] = "extreme")],
    ["duplicate question", (qs) => (qs[1]!["prompt"] = qs[0]!["prompt"])],
    ["a previously asked question", (qs, ctx) => (qs[2]!["prompt"] = ctx.stage.bank[0]!.prompt)],
    ["a part outside the provided data", (qs) => (qs[3]!["prompt"] = "How does the HC-SR04 Ultrasonic Sensor work here?")],
    ["too few questions", (qs) => qs.pop()],
    ["no focus-skill questions", (qs, ctx) => qs.forEach((q) => (q["skill"] = allowedSkills(ctx).find((s) => !ctx.plan.focusSkills.includes(s))))],
  ])("rejects a quiz with %s and falls back to local content", async (_, corrupt) => {
    const { state, stages } = setup();
    const base = readJourney().profile!;
    // Mark the first bank question as asked so "previously asked" can be tested.
    const profile = { ...base, history: { [stages[0]!.id]: { asked: [promptKey(stages[0]!.bank[0]!.prompt)], wrong: [], lastWrongSkills: [], attempts: [], pending: null } } };
    const ctx = { ...ctxFor(state, stages), profile };
    const body = aiBody(ctx, (qs) => corrupt(qs, ctx));
    expect(validateGeneratedQuiz(body, ctx)).toBeNull();
    const { client } = fakeClient(async () => response(body));
    const quiz = await preparePersonalizedQuiz({ state: { ...state, profile }, stages, index: 0, learnerId: "a", config, client });
    expect(quiz.source).toBe("local");
    expect(quiz.fallbackReason).toBe("bad-response");
    expect(quiz.questions).toHaveLength(5);
  });

  it("reuses the cached quiz after a reload without another request", async () => {
    const { stages } = setup();
    const ctx = ctxFor();
    const { client, spy } = fakeClient(async () => response(aiBody(ctx)));
    const quiz = await preparePersonalizedQuiz({ state: readJourney(), stages, index: 0, learnerId: "a", config, client });
    savePendingQuiz(quiz);
    // Simulate a reload: drop the in-memory copy and read localStorage again.
    const raw = localStorage.getItem(STORAGE_KEYS.journey)!;
    resetDemo();
    localStorage.setItem(STORAGE_KEYS.journey, raw);
    const reloaded = readJourney();
    expect(cachedQuiz(reloaded, stages[0]!.id)).toEqual(quiz);
    const again = await preparePersonalizedQuiz({ state: reloaded, stages, index: 0, learnerId: "a", config, client });
    expect(again).toEqual(quiz);
    expect(spy).toHaveBeenCalledTimes(1);
    // After the quiz is taken, the cache no longer applies to the next attempt.
    const answers = answer(quiz, (_, i) => i < 3);
    recordQuizResult(stages[0]!.id, quiz, answers, gradeQuiz(quiz, answers));
    expect(cachedQuiz(readJourney(), stages[0]!.id)).toBeNull();
  });

  it("asks again in the new language only when the language setting changes", async () => {
    const { stages } = setup();
    const quiz = await preparePersonalizedQuiz({ state: readJourney(), stages, index: 0, learnerId: "a", config: noKey });
    savePendingQuiz(quiz);
    expect(cachedQuiz(readJourney(), stages[0]!.id)).not.toBeNull();
    setJourneyLanguage("en");
    expect(cachedQuiz(readJourney(), stages[0]!.id)).toBeNull();
  });
});

describe("fallback paths", () => {
  const run = async (generate?: (params: GenerateContentParameters) => Promise<unknown>, settings = config) => {
    const { state, stages } = setup();
    const fake = generate ? fakeClient(generate) : undefined;
    const quiz = await preparePersonalizedQuiz({
      state,
      stages,
      index: 0,
      learnerId: "a",
      config: settings,
      ...(fake ? { client: fake.client } : {}),
    });
    return { quiz, spy: fake?.spy };
  };
  const expectLocal = (quiz: PersonalizedQuiz, reason: string) => {
    expect(quiz.source).toBe("local");
    expect(quiz.fallbackReason).toBe(reason);
    expect(quiz.questions).toHaveLength(5);
    expect(quiz.explanation.length).toBeGreaterThan(20);
  };

  it("uses local content without a request when there's no key", async () => {
    const { quiz, spy } = await run(async () => response({}), noKey);
    expectLocal(quiz, "missing-key");
    expect(spy).not.toHaveBeenCalled();
  });
  it("falls back when offline", async () => expectLocal((await run(async () => { throw new TypeError("Failed to fetch"); })).quiz, "network"));
  it("falls back on the free-tier limit", async () =>
    expectLocal((await run(async () => { throw new ApiError({ status: 429, message: '{"error":{"status":"RESOURCE_EXHAUSTED"}}' }); })).quiz, "rate-limit"));
  it("falls back on an invalid key", async () =>
    expectLocal((await run(async () => { throw new ApiError({ status: 400, message: '{"error":{"message":"API key not valid"}}' }); })).quiz, "invalid-key"));
  it("falls back on a blocked answer", async () => expectLocal((await run(async () => ({ candidates: [], promptFeedback: { blockReason: "SAFETY" } }))).quiz, "blocked"));
  it("falls back on an empty answer", async () => expectLocal((await run(async () => response("  "))).quiz, "empty"));
  it("falls back on malformed JSON", async () => expectLocal((await run(async () => response("{ questions: [ oops"))).quiz, "bad-response"));
  it("falls back on a timeout", async () => {
    const { state, stages } = setup();
    const { client } = fakeClient(
      (params) =>
        new Promise((_resolve, reject) =>
          params.config?.abortSignal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError"))),
        ),
    );
    const quiz = await preparePersonalizedQuiz({ state, stages, index: 0, learnerId: "a", config: { ...config, timeoutMs: 20 }, client });
    expectLocal(quiz, "timeout");
  });
});

describe("demo learners and storage", () => {
  it("keeps separate journeys per learner, and Reset demo clears both", () => {
    setup("traffic-light");
    switchLearner("b");
    expect(readJourney().project).toBeNull();
    setup("parking-sensor");
    expect(readJourney().project!.id).toBe("parking-sensor");
    switchLearner("a");
    expect(readJourney().project!.id).toBe("traffic-light");
    resetDemo();
    expect(readJourney().project).toBeNull();
    switchLearner("b");
    expect(readJourney().project).toBeNull();
  });

  it("defaults to Arabic and sanitizes a corrupt cached quiz", () => {
    setup();
    expect(readJourney().language).toBe("ar");
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEYS.journey)!);
    raw.profile.history = { "traffic-leds": { asked: ["x", 3], attempts: [], wrong: [], pending: { id: "bad", questions: [{ options: ["a"] }] } } };
    localStorage.setItem(STORAGE_KEYS.journey, JSON.stringify(raw));
    const raw2 = localStorage.getItem(STORAGE_KEYS.journey)!;
    resetDemo();
    localStorage.setItem(STORAGE_KEYS.journey, raw2);
    const history = readJourney().profile!.history["traffic-leds"]!;
    expect(history.asked).toEqual(["x"]);
    expect(history.pending).toBeNull();
  });

  it("covers each stage's skills with easy, medium and hard questions in the bank", () => {
    const { stages } = setup("parking-sensor");
    for (const stage of stages) {
      expect(stage.bank.length).toBeGreaterThanOrEqual(14);
      expect(new Set(stage.bank.map((q) => q.difficulty))).toEqual(new Set(["easy", "medium", "hard"]));
      expect(stageSkills(stage).length).toBeGreaterThanOrEqual(3);
    }
  });
});

// Keeps the QuizPlan import used for type checking of fixtures.
export type _Plan = QuizPlan;

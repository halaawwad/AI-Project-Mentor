import { ApiError, type GenerateContentParameters } from "@google/genai";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  answerRecords,
  buildLocalQuiz,
  initialProfile,
  MAX_ANSWER_RECORDS,
  planNextQuiz,
  stageSkills,
  updateProfileAfterQuiz,
} from "../lib/journey/adaptive";
import { allowedSkills, type AiQuizContext } from "../lib/journey/aiQuiz";
import { gradeQuiz, stageStatuses } from "../lib/journey/grading";
import { levelQuestions } from "../lib/journey/level";
import {
  cachedInsight,
  effectivePlan,
  evidence,
  mentorCheckpoint,
  pathSkills,
  planChanges,
  planForStage,
  type MentorContext,
} from "../lib/journey/mentor";
import { buildMentorSchema, validateMentorInsight } from "../lib/journey/mentorAi";
import { buildPath } from "../lib/journey/path";
import { mentorContext, prepareMentorInsight, preparePersonalizedQuiz } from "../lib/journey/personalize";
import {
  readJourney,
  recordQuizResult,
  resetDemo,
  saveMentorInsight,
  setJourneyLanguage,
  setJourneyLevel,
  startLearningJourney,
  switchLearner,
} from "../lib/journey/store";
import type { JourneyState, MentorInsight, PersonalizedQuiz, Question, Stage } from "../lib/journey/types";
import type { AiClient } from "../lib/suggest/aiEngine";
import type { AiConfig } from "../lib/suggest/config";
import { STORAGE_KEYS } from "../lib/storage";

const config: AiConfig = { apiKey: "test-key", model: "gemini-3.5-flash", timeoutMs: 5_000 };
const noKey: AiConfig = { ...config, apiKey: "" };
const allCorrect = levelQuestions.map((q) => q.correct);
/** Level check with the first question ("Current limiting", a traffic-light skill) wrong. */
const levelWrong = levelQuestions.map((q, i) => (i === 0 ? (q.correct + 1) % 4 : q.correct));
const passed = { attempts: 1, passed: true, bestScore: 80, lastScore: 80 };

const answer = (quiz: { questions: Question[] }, wrong: (q: Question, i: number) => boolean) =>
  quiz.questions.map((q, i) => (wrong(q, i) ? (q.correct + 1) % 4 : q.correct));

function setup(levelAnswers = levelWrong) {
  startLearningJourney("traffic-light");
  setJourneyLevel("intermediate", 3, levelAnswers);
  const state = readJourney();
  return { state, stages: buildPath(state) };
}
const ctxOf = (state: JourneyState = readJourney(), stages: Stage[] = buildPath(state)): MentorContext =>
  mentorContext(state, stages, mentorCheckpoint(state, stages)!);

function fakeClient(generate: (params: GenerateContentParameters) => Promise<unknown>) {
  const spy = vi.fn(generate);
  return { client: { models: { generateContent: spy } } as unknown as AiClient, spy };
}
const response = (body: unknown, finishReason = "STOP") => {
  const text = typeof body === "string" ? body : JSON.stringify(body);
  return { text, candidates: [{ finishReason, content: { role: "model", parts: [{ text }] } }] };
};

type Body = { diagnosis: Record<string, unknown>; plan: { items: Record<string, unknown>[]; changeNote: string } };

/**
 * A valid Gemini answer for the level-check context (Current limiting wrong): a remedial on
 * Current limiting first, then the stages: LEDs keep, timing shortened, button skippable.
 */
function mentorBody(ctx: MentorContext, change: (body: Body) => void = () => {}): Body {
  const [leds, timing, button] = ctx.stages.map((s) => s.id);
  const body: Body = {
    diagnosis: {
      summary: "تفهم المداخل التماثلية جيداً، لكنك تخلط في دور مقاومة الـLED.",
      strengths: ["Analog input"],
      weakSkills: ["Current limiting"],
      misconceptions: [{ skill: "Current limiting", text: "تظن أن المقاومة ترفع الجهد بدل أن تحدّ من التيار." }],
      confidence: "low",
      confidenceNote: "ثلاث إجابات فقط حتى الآن، لذا الثقة منخفضة.",
    },
    plan: {
      items: [
        { kind: "remedial", target: "Current limiting", action: "add-remedial", reason: "أخطأت في سؤال المقاومة.", explanation: "المقاومة مثل صنبور يحدّ من التيار المار في الـLED." },
        { kind: "stage", target: leds, action: "keep", reason: "تحتاج هذه المرحلة كاملة.", explanation: "" },
        { kind: "stage", target: timing, action: "shorten", reason: "أجبت عن المخارج الرقمية جيداً.", explanation: "" },
        { kind: "stage", target: button, action: "skippable", reason: "تبدو قوياً في المداخل.", explanation: "" },
      ],
      changeNote: "خطتك الأولى تبدأ بدرس قصير عن تحديد التيار.",
    },
  };
  change(body);
  return body;
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

describe("answer records", () => {
  it("records the level check: chosen and correct option, skill and difficulty", () => {
    const { state } = setup();
    const records = state.profile!.answers;
    expect(records).toHaveLength(3);
    const q = levelQuestions[0]!;
    const wrong = records.find((r) => r.questionId === q.id)!;
    expect(wrong).toMatchObject({
      stageId: "level",
      skill: q.skill,
      difficulty: q.difficulty,
      chosen: q.options[(q.correct + 1) % 4],
      chosenIndex: (q.correct + 1) % 4,
      correctAnswer: q.options[q.correct],
      correctIndex: q.correct,
      isCorrect: false,
    });
    expect(records.filter((r) => r.isCorrect)).toHaveLength(2);
  });

  it("records every quiz answer newest first, keeps unanswered ones, and survives a reload", () => {
    const { state, stages } = setup();
    const quiz = buildLocalQuiz(stages, 0, planNextQuiz(stages, 0, state.profile!, {}), state.profile!, "a", "ar");
    const answers: (number | null)[] = answer(quiz, (_, i) => i === 1);
    answers[4] = null;
    recordQuizResult(stages[0]!.id, quiz, answers, gradeQuiz(quiz, answers));
    const records = readJourney().profile!.answers;
    expect(records).toHaveLength(8);
    // Newest first: the last question of the quiz comes first.
    expect(records[0]).toMatchObject({ questionId: quiz.questions[4]!.id, chosen: "", chosenIndex: null, isCorrect: false });
    const second = quiz.questions[1]!;
    expect(records[3]).toMatchObject({ questionId: second.id, chosen: second.options[answers[1]!], correctAnswer: second.options[second.correct], isCorrect: false });
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEYS.journey)!);
    raw.profile.answers.push({ questionId: 3, skill: "x" });
    resetDemo();
    localStorage.setItem(STORAGE_KEYS.journey, JSON.stringify(raw));
    expect(readJourney().profile!.answers).toEqual(records);
  });

  it("keeps only the most recent records", () => {
    const { stages } = setup();
    let profile = initialProfile("intermediate", allCorrect);
    for (let i = 0; i < 12; i++) {
      const quiz = { id: `q${i}`, questions: stages[0]!.bank.slice(0, 5) };
      const answers = answer(quiz, () => false);
      profile = updateProfileAfterQuiz(profile, stages[0]!.id, quiz, answers, gradeQuiz(quiz, answers));
    }
    expect(profile.answers).toHaveLength(MAX_ANSWER_RECORDS);
    expect(answerRecords("s", [], [], "local")).toEqual([]);
  });
});

describe("diagnosis validation", () => {
  it("accepts a valid diagnosis and plan, and the request has the learner's real answers", async () => {
    const { state, stages } = setup();
    const ctx = ctxOf(state, stages);
    expect(validateMentorInsight(mentorBody(ctx), ctx)).toMatchObject({ ok: true });
    const { client, spy } = fakeClient(async () => response(mentorBody(ctx)));
    const insight = (await prepareMentorInsight({ state, stages, learnerId: "a", config, client }))!;
    expect(insight).toMatchObject({ source: "ai", checkpoint: "level", language: "ar", basedOn: 3 });
    expect(insight.fallbackReason).toBeUndefined();
    expect(insight.diagnosis.misconceptions[0]!.text).toContain("المقاومة");
    expect(spy).toHaveBeenCalledTimes(1);
    const [params] = spy.mock.calls[0]!;
    const contents = String(params.contents);
    const q = levelQuestions[0]!;
    expect(contents).toContain(`chose "${q.options[(q.correct + 1) % 4]}", correct "${q.options[q.correct]}" → wrong`);
    expect(contents).toContain("prerequisites: traffic-leds");
    expect(contents).toContain("Mastery (0–100)");
    expect(String(params.config?.systemInstruction)).toContain("keep technical terms");
    expect(params.config?.responseMimeType).toBe("application/json");
    expect(params.config?.responseJsonSchema).toEqual(buildMentorSchema(ctx));
    expect(params.config?.httpOptions?.retryOptions).toBeUndefined();
    expect(JSON.stringify(params)).not.toContain("test-key");
  });

  it.each<[string, string, (b: Body) => void]>([
    ["an unknown skill", "unknown skill", (b) => (b.diagnosis["weakSkills"] = ["Quantum tunnelling"])],
    ["a strength without evidence", "no evidence", (b) => (b.diagnosis["strengths"] = ["Ohm's law"])],
    ["a skill both strong and weak", "both", (b) => (b.diagnosis["strengths"] = ["Current limiting"])],
    ["a misconception without a wrong answer", "without a wrong answer", (b) => (b.diagnosis["misconceptions"] = [{ skill: "Analog input", text: "x" }])],
    ["high confidence on three answers", "confidence must be low", (b) => (b.diagnosis["confidence"] = "high")],
    ["no summary", "summary", (b) => (b.diagnosis["summary"] = " ")],
    ["no confidence note", "confidence note", (b) => (b.diagnosis["confidenceNote"] = "")],
    ["a part outside the project", "outside the project", (b) => (b.diagnosis["summary"] = "Try the HC-SR04 Ultrasonic Sensor.")],
  ])("rejects a diagnosis with %s and uses the local rules", async (_, error, corrupt) => {
    const { state, stages } = setup();
    const ctx = ctxOf(state, stages);
    const body = mentorBody(ctx, corrupt);
    const result = validateMentorInsight(body, ctx);
    expect(result.ok).toBe(false);
    expect(!result.ok && result.error).toContain(error);
    const { client } = fakeClient(async () => response(body));
    const insight = (await prepareMentorInsight({ state, stages, learnerId: "a", config, client }))!;
    expect(insight).toMatchObject({ source: "local", fallbackReason: "bad-response" });
  });
});

describe("plan validation", () => {
  it.each<[string, string, (b: Body, ctx: MentorContext) => void, boolean?]>([
    ["an unknown stage", "unknown stage", (b) => b.plan.items.push({ kind: "stage", target: "traffic-flying", action: "keep", reason: "x", explanation: "" })],
    ["a removed core stage", "removes core stage", (b) => b.plan.items.pop()],
    ["broken prerequisite order", "broken prerequisite order", (b) => b.plan.items.splice(2, 2, b.plan.items[3]!, b.plan.items[2]!)],
    ["a missing reason", "missing reason", (b) => (b.plan.items[2]!["reason"] = " ")],
    ["a duplicate stage", "duplicate stage", (b) => b.plan.items.push({ ...b.plan.items[1]! })],
    ["a skippable stage that covers a weak skill", "covers a weak skill", (b) => (b.plan.items[1]!["action"] = "skippable")],
    ["a stage marked add-remedial", "can't be add-remedial", (b) => (b.plan.items[1]!["action"] = "add-remedial")],
    ["a remedial for an unknown skill", "unknown skill", (b) => (b.plan.items[0]!["target"] = "Quantum tunnelling")],
    ["a remedial for a skill that isn't weak", "isn't weak", (b) => (b.plan.items[0]!["target"] = "Ohm's law")],
    ["no change note", "change note", (b) => (b.plan.changeNote = "")],
    ["a remedial before a completed stage", "before a completed stage", () => {}, true],
    [
      "a completed stage that is shortened",
      "can't be shorten",
      (b) => {
        const [remedial, leds] = b.plan.items;
        b.plan.items.splice(0, 2, { ...leds!, action: "shorten" }, remedial!);
      },
      true,
    ],
  ])("rejects a plan with %s", async (_, error, corrupt, firstPassed = false) => {
    const { stages } = setup();
    const base = ctxOf();
    const ctx: MentorContext = firstPassed ? { ...base, progress: { [stages[0]!.id]: passed } } : base;
    const body = mentorBody(ctx, (b) => corrupt(b, ctx));
    const result = validateMentorInsight(body, ctx);
    expect(result.ok).toBe(false);
    expect(!result.ok && result.error).toContain(error);
    const state = { ...readJourney(), progress: ctx.progress };
    const { client, spy } = fakeClient(async () => response(body));
    const insight = (await prepareMentorInsight({ state, stages, learnerId: "a", config, client }))!;
    expect(spy).toHaveBeenCalledTimes(1);
    expect(insight).toMatchObject({ source: "local", fallbackReason: "bad-response" });
    expect(effectivePlan(stages, insight)).not.toBeNull();
  });
});

describe("skippable stages and gating", () => {
  it("keeps a skippable stage available but still requires its quiz at 80% to pass", async () => {
    const { state, stages } = setup();
    const { client } = fakeClient(async () => response(mentorBody(ctxOf(state, stages))));
    saveMentorInsight((await prepareMentorInsight({ state, stages, learnerId: "a", config, client }))!);
    const items = effectivePlan(stages, readJourney().mentor!.insights[0]!)!;
    expect(planForStage(items, stages[2]!.id).item!.action).toBe("skippable");
    expect(planForStage(items, stages[0]!.id).remedials.map((r) => r.target)).toEqual(["Current limiting"]);
    // Locking ignores the plan: the skippable stage opens only after the stages before it are passed.
    expect(stageStatuses(stages, readJourney().progress)).toEqual(["current", "locked", "locked"]);
    const take = (index: number, wrong: number) => {
      const current = readJourney();
      const quiz = buildLocalQuiz(stages, index, planNextQuiz(stages, index, current.profile!, current.progress), current.profile!, "a", "ar");
      const answers = answer(quiz, (_, i) => i < wrong);
      recordQuizResult(stages[index]!.id, quiz, answers, gradeQuiz(quiz, answers));
    };
    take(0, 0);
    take(1, 0);
    expect(stageStatuses(stages, readJourney().progress)).toEqual(["passed", "passed", "current"]);
    take(2, 2); // 60%: not passed, even though the plan says skippable.
    expect(readJourney().progress[stages[2]!.id]!.passed).toBe(false);
    expect(stageStatuses(stages, readJourney().progress)[2]).toBe("current");
    take(2, 1); // 80%: passed.
    expect(stageStatuses(stages, readJourney().progress)).toEqual(["passed", "passed", "passed"]);
  });
});

/** Stage 1 skills once each, plus one question from stage 2, so one wrong answer still passes (80%). */
function distinctQuiz(stages: Stage[]): Question[] {
  const seen = new Set<string>();
  const questions = stages[0]!.bank.filter((q) => !seen.has(q.skill) && seen.add(q.skill));
  return [...questions, ...stages[1]!.bank].slice(0, 5);
}
function passFirstStageMissing(stages: Stage[], skill: string, learner: string) {
  const state = readJourney();
  const local = buildLocalQuiz(stages, 0, planNextQuiz(stages, 0, state.profile!, state.progress), state.profile!, learner, "ar");
  const quiz: PersonalizedQuiz = { ...local, questions: distinctQuiz(stages) };
  const answers = answer(quiz, (q) => q.skill === skill);
  const grade = gradeQuiz(quiz, answers);
  expect(grade.passed).toBe(true);
  recordQuizResult(stages[0]!.id, quiz, answers, grade);
}

/** A fake Gemini mentor that reads the wrong answers from the prompt and plans around them. */
function readingMentor() {
  return fakeClient(async (params) => {
    const contents = String(params.contents);
    const weak = [...new Set([...contents.matchAll(/^- \[([^·\]]+) · [^\n]*→ wrong$/gm)].map((m) => m[1]!.trim()))];
    const stageIds = [...contents.matchAll(/^- ([a-z-]+) \| /gm)].map((m) => m[1]!);
    const done = [...contents.matchAll(/^- ([a-z-]+) \| [^\n]*\| completed/gm)].map((m) => m[1]!);
    const skill = weak.find((s) => contents.includes(`Remedial skill tags (taught in this path): `) && contents.split("Remedial skill tags (taught in this path): ")[1]!.split("\n")[0]!.split(", ").includes(s));
    const items: Record<string, unknown>[] = [];
    stageIds.forEach((id) => {
      if (skill && !done.includes(id) && !items.some((i) => i["kind"] === "remedial"))
        items.push({ kind: "remedial", target: skill, action: "add-remedial", reason: `weak: ${skill}`, explanation: `Personal note on ${skill}.` });
      items.push({ kind: "stage", target: id, action: done.includes(id) ? "keep" : skill === "LED polarity" && id === "traffic-button" ? "shorten" : "keep", reason: `reason for ${id}`, explanation: "" });
    });
    return response({
      diagnosis: {
        summary: `Weak in ${weak.join(", ") || "nothing yet"}.`,
        strengths: [],
        weakSkills: weak,
        misconceptions: weak.map((s) => ({ skill: s, text: `misreads ${s}` })),
        confidence: Number(/<answer_records count="(\d+)">/.exec(contents)?.[1]) < 6 ? "low" : "medium",
        confidenceNote: "Based on the answers so far.",
      },
      plan: { items, changeNote: `Plan updated around ${skill ?? "your answers"}.` },
    });
  });
}

describe("plan updates after a stage", () => {
  it("makes one new request after a completed stage and explains what changed", async () => {
    const { stages } = setup(allCorrect);
    const { client, spy } = readingMentor();
    const first = (await prepareMentorInsight({ state: readJourney(), stages, learnerId: "a", config, client }))!;
    saveMentorInsight(first);
    expect(first.source).toBe("ai");
    expect(first.diagnosis.confidence).toBe("low");
    expect(first.plan.items.some((i) => i.kind === "remedial")).toBe(false);
    // Passing stage 1 moves the checkpoint, so the cached plan no longer applies.
    passFirstStageMissing(stages, "LED polarity", "a");
    const after = readJourney();
    expect(mentorCheckpoint(after, stages)).toBe(`stage:${stages[0]!.id}`);
    expect(cachedInsight(after, `stage:${stages[0]!.id}`)).toBeNull();
    const second = (await prepareMentorInsight({ state: after, stages, learnerId: "a", config, client }))!;
    expect(spy).toHaveBeenCalledTimes(2);
    const contents = String(spy.mock.calls[1]![0].contents);
    expect(contents).toContain("completed (best 80%)");
    expect(contents).toContain(`- stage ${stages[0]!.id}: keep`);
    saveMentorInsight(second);
    const mentor = readJourney().mentor!;
    expect(mentor.checkpoint).toBe(`stage:${stages[0]!.id}`);
    expect(mentor.previous!.checkpoint).toBe("level");
    expect(planChanges(mentor.previous!.items, second.plan.items)).toEqual(
      expect.arrayContaining([
        { kind: "added-remedial", skill: "LED polarity" },
        { kind: "action", stageId: "traffic-button", from: "keep", to: "shorten" },
      ]),
    );
    expect(second.plan.changeNote).toContain("LED polarity");
    // A practice quiz on the passed stage doesn't change the checkpoint: no further request.
    const again = await prepareMentorInsight({ state: readJourney(), stages, learnerId: "a", config, client });
    expect(again).toEqual(second);
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it("describes the changes with the local rules too", async () => {
    const { stages } = setup(allCorrect);
    saveMentorInsight((await prepareMentorInsight({ state: readJourney(), stages, learnerId: "a", config: noKey }))!);
    passFirstStageMissing(stages, "Ohm's law", "a");
    const local = (await prepareMentorInsight({ state: readJourney(), stages, learnerId: "a", config: noKey }))!;
    expect(local.source).toBe("local");
    expect(local.diagnosis.weakSkills).toEqual(["Ohm's law"]);
    expect(local.plan.changeNote).toContain("قانون أوم");
  });
});

describe("two learners on the same project", () => {
  const runLearner = async (learner: "a" | "b", missed: string, settings: AiConfig, client?: AiClient) => {
    switchLearner(learner);
    const { stages } = setup(allCorrect);
    passFirstStageMissing(stages, missed, learner);
    const insight = (await prepareMentorInsight({ state: readJourney(), stages, learnerId: learner, config: settings, ...(client ? { client } : {}) }))!;
    saveMentorInsight(insight);
    return insight;
  };

  it("gives Student A (weak in LED polarity) and Student B (weak in Ohm's law) different AI analyses and plans", async () => {
    const { client } = readingMentor();
    const a = await runLearner("a", "LED polarity", config, client);
    const b = await runLearner("b", "Ohm's law", config, client);
    expect(a.source).toBe("ai");
    expect(b.source).toBe("ai");
    expect(a.diagnosis.weakSkills).toEqual(["LED polarity"]);
    expect(b.diagnosis.weakSkills).toEqual(["Ohm's law"]);
    expect(a.plan.items).not.toEqual(b.plan.items);
    expect(a.plan.items.find((i) => i.kind === "remedial")!.target).toBe("LED polarity");
    expect(b.plan.items.find((i) => i.kind === "remedial")!.target).toBe("Ohm's law");
    // Each learner keeps their own plan.
    switchLearner("a");
    expect(readJourney().mentor!.insights[0]!.id).toBe(a.id);
    switchLearner("b");
    expect(readJourney().mentor!.insights[0]!.id).toBe(b.id);
  });

  it("also gives them different plans with the local rules", async () => {
    const a = await runLearner("a", "LED polarity", noKey);
    const b = await runLearner("b", "Ohm's law", noKey);
    expect(a.source).toBe("local");
    expect(a.diagnosis.weakSkills).toContain("LED polarity");
    expect(b.diagnosis.weakSkills).toContain("Ohm's law");
    expect(a.plan.items.filter((i) => i.kind === "remedial").map((i) => i.target)).toEqual(["LED polarity"]);
    expect(b.plan.items.filter((i) => i.kind === "remedial").map((i) => i.target)).toEqual(["Ohm's law"]);
    expect(a.diagnosis.misconceptions[0]!.text).toContain("بدلاً من");
  });
});

describe("cache", () => {
  it("reuses the cached analysis and plan without another request, also after a reload", async () => {
    const { stages } = setup();
    const { client, spy } = fakeClient(async () => response(mentorBody(ctxOf())));
    const insight = (await prepareMentorInsight({ state: readJourney(), stages, learnerId: "a", config, client }))!;
    saveMentorInsight(insight);
    expect(await prepareMentorInsight({ state: readJourney(), stages, learnerId: "a", config, client })).toEqual(insight);
    const raw = localStorage.getItem(STORAGE_KEYS.journey)!;
    resetDemo();
    localStorage.setItem(STORAGE_KEYS.journey, raw);
    const reloaded = readJourney();
    expect(cachedInsight(reloaded, "level")).toEqual(insight);
    expect(await prepareMentorInsight({ state: reloaded, stages, learnerId: "a", config, client })).toEqual(insight);
    expect(spy).toHaveBeenCalledTimes(1);
    // "Try Gemini again" is an explicit request.
    await prepareMentorInsight({ state: reloaded, stages, learnerId: "a", config, client, force: true });
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it("asks once for a new language, then reuses each language", async () => {
    const { stages } = setup();
    const { client, spy } = fakeClient(async () => response(mentorBody(ctxOf())));
    saveMentorInsight((await prepareMentorInsight({ state: readJourney(), stages, learnerId: "a", config, client }))!);
    setJourneyLanguage("en");
    expect(cachedInsight(readJourney(), "level")).toBeNull();
    const en = (await prepareMentorInsight({ state: readJourney(), stages, learnerId: "a", config, client }))!;
    expect(en.language).toBe("en");
    expect(String(spy.mock.calls[1]![0].config?.systemInstruction)).toContain("Write all text in English");
    saveMentorInsight(en);
    setJourneyLanguage("ar");
    await prepareMentorInsight({ state: readJourney(), stages, learnerId: "a", config, client });
    expect(readJourney().mentor!.insights.map((i) => i.language).sort()).toEqual(["ar", "en"]);
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it("starts over after a new level check and drops a corrupt cached insight", async () => {
    const { stages } = setup();
    saveMentorInsight((await prepareMentorInsight({ state: readJourney(), stages, learnerId: "a", config: noKey }))!);
    expect(readJourney().mentor).not.toBeNull();
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEYS.journey)!);
    raw.mentor.insights[0].plan.items = [{ kind: "teleport" }];
    resetDemo();
    localStorage.setItem(STORAGE_KEYS.journey, JSON.stringify(raw));
    expect(readJourney().mentor).toBeNull();
    setJourneyLevel("beginner", 1, levelWrong);
    expect(readJourney().mentor).toBeNull();
  });
});

describe("fallbacks", () => {
  const run = async (generate: ((params: GenerateContentParameters) => Promise<unknown>) | null, settings = config) => {
    const { stages } = setup();
    const fake = generate ? fakeClient(generate) : null;
    const insight = (await prepareMentorInsight({
      state: readJourney(),
      stages,
      learnerId: "a",
      config: settings,
      ...(fake ? { client: fake.client } : {}),
    }))!;
    return { insight, stages, spy: fake?.spy };
  };
  const expectLocal = ({ insight, stages }: { insight: MentorInsight; stages: Stage[] }, reason: string) => {
    expect(insight.source).toBe("local");
    expect(insight.fallbackReason).toBe(reason);
    // The rule-based analysis and path: Current limiting is weak (level check), with a remedial.
    expect(insight.diagnosis.weakSkills).toEqual(["Current limiting"]);
    expect(insight.diagnosis.confidence).toBe("low");
    expect(effectivePlan(stages, insight)!.map((i) => `${i.kind}:${i.target}:${i.action}`)).toEqual([
      "remedial:Current limiting:add-remedial",
      ...stages.map((s) => `stage:${s.id}:keep`),
    ]);
  };

  it("uses the local rules without a request when there's no key", async () => {
    const result = await run(async () => response({}), noKey);
    expectLocal(result, "missing-key");
    expect(result.spy).not.toHaveBeenCalled();
  });
  it.each<[string, () => Promise<unknown>]>([
    ["network", async () => { throw new TypeError("Failed to fetch"); }],
    ["rate-limit", async () => { throw new ApiError({ status: 429, message: '{"error":{"status":"RESOURCE_EXHAUSTED"}}' }); }],
    ["invalid-key", async () => { throw new ApiError({ status: 400, message: '{"error":{"message":"API key not valid"}}' }); }],
    ["unavailable", async () => { throw new ApiError({ status: 503, message: "overloaded" }); }],
    ["blocked", async () => ({ candidates: [], promptFeedback: { blockReason: "SAFETY" } })],
    ["empty", async () => response("  ")],
    ["bad-response", async () => response("{ plan: [ oops")],
    ["bad-response", async () => response({ diagnosis: {}, plan: {} })],
  ])("falls back to local rules on %s, after exactly one request", async (reason, generate) => {
    const result = await run(generate);
    expectLocal(result, reason);
    expect(result.spy).toHaveBeenCalledTimes(1);
  });
  it("falls back on a timeout", async () => {
    const { stages } = setup();
    const { client } = fakeClient(
      (params) =>
        new Promise((_resolve, reject) =>
          params.config?.abortSignal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError"))),
        ),
    );
    const insight = (await prepareMentorInsight({ state: readJourney(), stages, learnerId: "a", config: { ...config, timeoutMs: 20 }, client }))!;
    expectLocal({ insight, stages }, "timeout");
  });
  it("returns nothing before the level check", async () => {
    startLearningJourney("traffic-light");
    expect(await prepareMentorInsight({ state: readJourney(), stages: buildPath(readJourney()), learnerId: "a", config })).toBeNull();
  });
});

describe("diagnosis in the quiz request", () => {
  it("sends the latest misconceptions to the Gemini quiz request", async () => {
    const { stages } = setup();
    const mentor = fakeClient(async () => response(mentorBody(ctxOf())));
    saveMentorInsight((await prepareMentorInsight({ state: readJourney(), stages, learnerId: "a", config, client: mentor.client }))!);
    const state = readJourney();
    const ctx: Pick<AiQuizContext, "stage" | "plan"> = { stage: stages[0]!, plan: planNextQuiz(stages, 0, state.profile!, state.progress) };
    const skills = allowedSkills(ctx);
    const order = [ctx.plan.focusSkills[0]!, ctx.plan.focusSkills[1] ?? ctx.plan.focusSkills[0]!, ...skills];
    const quizBody = {
      explanation: "شرح مخصص.",
      practiceTask: "تمرين في 3D Lab.",
      questions: order.slice(0, 5).map((skill, i) => ({
        prompt: `سؤال ${i + 1} عن ${skill}`,
        options: [`أ${i}`, `ب${i}`, `ج${i}`, `د${i}`],
        correctIndex: 0,
        explanation: "شرح",
        skill,
        difficulty: ctx.plan.difficulty,
      })),
    };
    const quizClient = fakeClient(async () => response(quizBody));
    const quiz = await preparePersonalizedQuiz({ state, stages, index: 0, learnerId: "a", config, client: quizClient.client });
    expect(quiz.source).toBe("ai");
    const contents = String(quizClient.spy.mock.calls[0]![0].contents);
    expect(contents).toContain('<mentor_analysis source="ai">');
    expect(contents).toContain("تظن أن المقاومة ترفع الجهد");
    expect(String(quizClient.spy.mock.calls[0]![0].config?.systemInstruction)).toContain("misconception");
  });

  it("uses only skills with evidence and path skills for remedial targets", () => {
    const { stages } = setup();
    const ctx = ctxOf();
    const { assessed, wrong } = evidence(ctx.profile);
    expect([...wrong]).toEqual(["Current limiting"]);
    expect(assessed.has("Analog input")).toBe(true);
    expect(pathSkills(stages)).toContain("Current limiting");
    expect(pathSkills(stages)).not.toContain("Analog input");
    expect(stageSkills(stages[2]!)).not.toContain("Current limiting");
  });
});

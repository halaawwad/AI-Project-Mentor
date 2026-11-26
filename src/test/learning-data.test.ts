import type { GenerateContentParameters } from "@google/genai";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildLocalQuiz, planNextQuiz } from "../lib/journey/adaptive";
import { buildQuizPrompt, buildQuizSystemPrompt } from "../lib/journey/aiQuiz";
import { buildGenericPath } from "../lib/journey/generic";
import { gradeQuiz } from "../lib/journey/grading";
import { hasArabic, skillLabelsAr } from "../lib/journey/i18n";
import { aggregateInsights, anonymizedExport } from "../lib/journey/insights";
import { levelQuestions } from "../lib/journey/level";
import { mentorCheckpoint } from "../lib/journey/mentor";
import { buildMentorPrompt, buildMentorSystemPrompt } from "../lib/journey/mentorAi";
import {
  EXAMPLE_DIAGNOSIS,
  exampleQuestions,
  knownMisconceptions,
  misconceptionForOption,
  misconceptionForRecord,
  questionMisconceptions,
  retrieveMisconceptions,
} from "../lib/journey/misconceptions";
import { buildPath } from "../lib/journey/path";
import { mentorContext, prepareMentorInsight } from "../lib/journey/personalize";
import { basics, learningProjects } from "../lib/journey/projects";
import {
  readJourney,
  readLearnerJourneys,
  recordQuizResult,
  resetDemo,
  setJourneyLevel,
  startIdeaJourney,
  startLearningJourney,
  switchLearner,
} from "../lib/journey/store";
import type { AnswerRecord, PersonalizedQuiz, Question, Stage } from "../lib/journey/types";
import type { AiClient } from "../lib/suggest/aiEngine";

const allCorrect = levelQuestions.map((q) => q.correct);
const generic = buildGenericPath([
  { key: "esp32_devkit_v1", quantity: 1 },
  { key: "dht22", quantity: 1 },
  { key: "relay_5v", quantity: 1 },
  { key: "push_button", quantity: 1 },
]);
const bank: Question[] = [
  ...levelQuestions,
  ...[basics, ...learningProjects.flatMap((p) => p.stages), ...generic].flatMap((s) => s.bank),
];
const traffic = learningProjects.find((p) => p.id === "traffic-light")!.stages;
const byPrompt = (stages: Stage[], prompt: string) => stages.flatMap((s) => s.bank).find((q) => q.prompt === prompt)!;
const ledQ = byPrompt(traffic, "Which LED leg connects toward the positive side?");
const ohmQ = byPrompt(traffic, "5 V supply, 2 V LED, 15 mA target: the resistor is about…");
const pick = (q: Question, option: string) => q.options.indexOf(option);

function record(q: Question, chosen: number | null, overrides: Partial<AnswerRecord> = {}): AnswerRecord {
  return {
    questionId: q.id,
    stageId: "traffic-leds",
    skill: q.skill,
    difficulty: q.difficulty,
    prompt: q.prompt,
    chosen: chosen === null ? "" : q.options[chosen]!,
    chosenIndex: chosen,
    correctAnswer: q.options[q.correct]!,
    correctIndex: q.correct,
    isCorrect: chosen === q.correct,
    source: "local",
    ...overrides,
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

describe("misconception knowledge base and mapping", () => {
  it("has a unique ID, a known skill tag and Arabic and English text for every entry", () => {
    expect(new Set(knownMisconceptions.map((k) => k.id)).size).toBe(knownMisconceptions.length);
    for (const k of knownMisconceptions) {
      expect(skillLabelsAr[k.skill], k.id).toBeTruthy();
      for (const text of [k.description, k.correction]) {
        expect(text.en.trim(), k.id).not.toBe("");
        expect(hasArabic(text.ar), k.id).toBe(true);
      }
      expect(k.matches.length, k.id).toBeGreaterThan(0);
    }
  });

  it("maps only real wrong options of local bank questions with the same skill, each to one ID", () => {
    const keys = new Set<string>();
    for (const k of knownMisconceptions)
      for (const [skill, option] of k.matches) {
        const key = `${skill}|${option}`;
        expect(keys.has(key), `${key} is mapped twice`).toBe(false);
        keys.add(key);
        const asWrong = bank.some((q) => q.skill === skill && q.options.some((o, i) => o === option && i !== q.correct));
        expect(asWrong, `${k.id}: "${option}" is not a wrong option of a ${skill} question`).toBe(true);
        expect(bank.some((q) => q.skill === skill && q.options[q.correct] === option), `${k.id}: "${option}" is a correct answer`).toBe(false);
      }
  });

  it("maps the wrong options of a question and ignores right or unanswered ones", () => {
    const mapped = questionMisconceptions(ledQ);
    expect(mapped[ledQ.correct]).toBeNull();
    expect(mapped[pick(ledQ, "The cathode (shorter leg)")]).toBe("led-polarity-reversed");
    expect(mapped[pick(ledQ, "Either; LEDs have no polarity")]).toBe("led-no-polarity");
    expect(mapped[pick(ledQ, "Neither")]).toBeNull();
    expect(misconceptionForOption("Loads", "Directly from a digital pin")!.id).toBe("motor-direct-pin");
    // "Nothing" means different things for different skills.
    expect(misconceptionForOption("Current limiting", "Nothing")!.id).toBe("led-no-resistor");
    expect(misconceptionForOption("Hysteresis", "Nothing")!.id).toBe("single-threshold");
    expect(misconceptionForRecord(record(ledQ, ledQ.correct))).toBeNull();
    expect(misconceptionForRecord(record(ledQ, null))).toBeNull();
    expect(misconceptionForRecord(record(ohmQ, pick(ohmQ, "2,000 Ω")))!.id).toBe("ohms-law-units");
    const covered = bank.filter((q) => questionMisconceptions(q).some(Boolean)).length;
    expect(covered).toBeGreaterThanOrEqual(40);
  });
});

describe("retrieval for Gemini requests", () => {
  const cathode = record(ledQ, pick(ledQ, "The cathode (shorter leg)"));
  const ohm = record(ohmQ, pick(ohmQ, "20 Ω"));
  const right = record(byPrompt(traffic, "Why debounce the button?"), byPrompt(traffic, "Why debounce the button?").correct);
  const aiWrong: AnswerRecord = { ...cathode, questionId: "ai-x", skill: "Relay contacts", chosen: "خيار ب", source: "ai" };

  it("returns only misconceptions behind recent wrong answers, exact matches first", () => {
    const found = retrieveMisconceptions([cathode, ohm, cathode, right, aiWrong]);
    expect(found.map((f) => [f.misconception.id, f.matched])).toEqual([
      ["led-polarity-reversed", 2],
      ["ohms-law-units", 1],
      ["relay-nc-no", 0],
    ]);
    expect(retrieveMisconceptions([right])).toEqual([]);
    expect(retrieveMisconceptions([])).toEqual([]);
  });

  it("keeps requests small: limited to the allowed skills, a few items and recent answers", () => {
    expect(retrieveMisconceptions([cathode, ohm], { skills: ["Ohm's law"] }).map((f) => f.misconception.id)).toEqual(["ohms-law-units"]);
    expect(retrieveMisconceptions([cathode, ohm, aiWrong], { limit: 1 })).toHaveLength(1);
    const old = [...Array.from({ length: 20 }, () => right), ohm];
    expect(retrieveMisconceptions(old)).toEqual([]);
  });

  it("picks few-shot questions on the relevant skills, preferring ones the learner has seen", () => {
    const seen = byPrompt(traffic, "If you reverse an LED in a 5 V circuit with a resistor…");
    const picked = exampleQuestions(traffic, ["LED polarity", "Ohm's law"], new Set([seen.id]));
    expect(picked).toHaveLength(3);
    expect(picked[0]!.id).toBe(seen.id);
    expect(picked.map((q) => q.skill)).toEqual(expect.arrayContaining(["LED polarity", "Ohm's law"]));
  });

  it("grounds the mentor request in the learner's matched misconceptions plus examples", () => {
    startLearningJourney("traffic-light");
    setJourneyLevel("intermediate", 3, allCorrect);
    const state = readJourney();
    const stages = buildPath(state);
    const profile = { ...state.profile!, answers: [cathode, ohm, ...state.profile!.answers] };
    const ctx = mentorContext({ ...state, profile }, stages, mentorCheckpoint(state, stages)!);
    const prompt = buildMentorPrompt(ctx);
    const known = prompt.split("<known_misconceptions>")[1]!.split("</known_misconceptions>")[0]!;
    expect(known).toContain("[led-polarity-reversed]");
    expect(known).toContain("[ohms-law-units]");
    expect(known).not.toContain("relay-nc-no");
    expect(known.trim().split("\n").length).toBeLessThanOrEqual(4);
    const examples = prompt.split("<examples>")[1]!.split("</examples>")[0]!;
    expect(examples.match(/^- \[/gm)!.length).toBeLessThanOrEqual(3);
    expect(examples).toContain(EXAMPLE_DIAGNOSIS);
    expect(examples).toContain("[LED polarity");
    expect(buildMentorSystemPrompt("ar")).toContain("Known misconceptions were matched locally");
    expect(prompt.length).toBeLessThan(9000);
  });

  it("adds matched misconceptions and two style examples to the quiz request", () => {
    startLearningJourney("traffic-light");
    setJourneyLevel("intermediate", 3, allCorrect);
    const state = readJourney();
    const stages = buildPath(state);
    const delayQ = byPrompt(stages, "During delay(5000), the Uno…");
    const profile = { ...state.profile!, answers: [cathode, record(delayQ, pick(delayQ, "reads every button")), ...state.profile!.answers] };
    const plan = planNextQuiz(stages, 0, profile, {});
    const prompt = buildQuizPrompt({ stage: stages[0]!, plan, profile, language: "ar", projectParts: state.parts.map((p) => p.key) });
    expect(prompt).toContain("[led-polarity-reversed]");
    // Only skills allowed in this stage: the timing-stage mistake isn't sent.
    expect(prompt).not.toContain("delay-blocking");
    const examples = prompt.split("<style_examples>")[1]!.split("</style_examples>")[0]!;
    expect(examples.match(/^- \[/gm)).toHaveLength(2);
    expect(buildQuizSystemPrompt("ar")).toContain("use their wrong ideas as distractors");
  });

  it("sends the retrieved misconceptions in the actual (mocked) Gemini request", async () => {
    startLearningJourney("traffic-light");
    setJourneyLevel("intermediate", 3, allCorrect);
    const state = readJourney();
    const spy = vi.fn(async (_: GenerateContentParameters) => ({ text: "{}", candidates: [{ finishReason: "STOP" }] }));
    const client = { models: { generateContent: spy } } as unknown as AiClient;
    const profile = { ...state.profile!, answers: [cathode, ...state.profile!.answers] };
    const insight = await prepareMentorInsight({
      state: { ...state, profile },
      stages: buildPath(state),
      learnerId: "a",
      config: { apiKey: "test-key", model: "gemini-3.5-flash", timeoutMs: 5000 },
      client,
    });
    expect(insight!.source).toBe("local");
    expect(spy).toHaveBeenCalledTimes(1);
    expect(String(spy.mock.calls[0]![0].contents)).toContain("[led-polarity-reversed]");
  });
});

/** Records a quiz made of the given questions with the given answers for the active learner. */
function takeQuiz(stages: Stage[], index: number, questions: Question[] | null, answers: (q: Question) => number) {
  const state = readJourney();
  const plan = planNextQuiz(stages, index, state.profile!, state.progress);
  const local = buildLocalQuiz(stages, index, plan, state.profile!, "x", "ar");
  const quiz: PersonalizedQuiz = questions ? { ...local, questions } : local;
  const given = quiz.questions.map(answers);
  const grade = gradeQuiz(quiz, given);
  recordQuizResult(stages[index]!.id, quiz, given, grade);
  return { quiz, grade };
}

/** Student A: fails stage 1 (cathode + wrong Ohm's law), then passes the retry. Student B: one cathode mistake. */
function demoData() {
  startLearningJourney("traffic-light");
  setJourneyLevel("intermediate", 3, allCorrect);
  const stages = buildPath(readJourney());
  const others = stages[0]!.bank.filter((q) => q.skill !== "LED polarity" && q.skill !== "Ohm's law").slice(0, 3);
  const first = takeQuiz(stages, 0, [ledQ, ohmQ, ...others], (q) =>
    q === ledQ ? pick(ledQ, "The cathode (shorter leg)") : q === ohmQ ? pick(ohmQ, "2,000 Ω") : q.correct,
  );
  expect(first.grade.passed).toBe(false);
  const retry = takeQuiz(stages, 0, null, (q) => q.correct);
  expect(retry.quiz.plan.kind).toBe("retry");
  switchLearner("b");
  startLearningJourney("traffic-light");
  setJourneyLevel("intermediate", 3, allCorrect);
  const b = takeQuiz(stages, 0, [ledQ, ...others, ohmQ], (q) => (q === ledQ ? pick(ledQ, "The cathode (shorter leg)") : q.correct));
  expect(b.grade.passed).toBe(true);
  return { stages, retryFocus: retry.quiz.plan.focusSkills[0]! };
}

describe("learning insights (local aggregation)", () => {
  it("counts common misconceptions, hardest questions and explanations followed by a pass", () => {
    const { retryFocus } = demoData();
    // Student B is active, so Student A's data comes back from localStorage through the sanitizer.
    const data = readLearnerJourneys();
    expect(data.map((d) => d.learner)).toEqual(["a", "b"]);
    const insights = aggregateInsights(data, "en");
    expect(insights).toMatchObject({ learners: 2, answers: 6 + 5 + 5 + 5, wrongAnswers: 3, attempts: 3 });
    expect(insights.misconceptions.map((m) => [m.misconception.id, m.count, m.learners])).toEqual([
      ["led-polarity-reversed", 2, 2],
      ["ohms-law-units", 1, 1],
    ]);
    expect(insights.hardestQuestions[0]).toMatchObject({ questionId: ledQ.id, answered: 2, correct: 0, rate: 0 });
    expect(insights.hardestQuestions[1]).toMatchObject({ questionId: ohmQ.id, answered: 2, correct: 1, rate: 50 });
    expect(insights.explanations).toEqual([
      { stageId: "traffic-leds", stageTitle: "LEDs and resistors", skill: retryFocus, source: "local", shown: 1, passed: 1 },
    ]);
    const ar = aggregateInsights(data, "ar");
    expect(ar.hardestQuestions[0]!.prompt).toBe(ledQ.ar!.prompt);
    expect(ar.explanations[0]!.stageTitle).toBe("الصمامات والمقاومات");
  });

  it("is empty without saved learners", () => {
    expect(aggregateInsights(readLearnerJourneys(), "en")).toMatchObject({
      learners: 0,
      answers: 0,
      misconceptions: [],
      hardestQuestions: [],
      explanations: [],
    });
  });
});

describe("anonymized export", () => {
  it("exports answer records and outcomes without names, descriptions or the API key", () => {
    demoData();
    switchLearner("a");
    // Student A's journey becomes an idea journey whose free text holds a name.
    startIdeaJourney("My name is Sara and I want a plant watering box", [{ key: "arduino_uno", quantity: 1 }]);
    switchLearner("b");
    const data = readLearnerJourneys();
    const exported = anonymizedExport(data, new Date("2026-11-26T10:00:00Z"));
    const json = JSON.stringify(exported);
    expect(exported).toMatchObject({ format: "aipm.learning-records", version: 1, exportedAt: "2026-11-26T10:00:00.000Z", passMark: 80 });
    // Student A has no level or profile any more, so only Student B is exported, as learner-1.
    expect(exported.learners.map((l) => l.learner)).toEqual(["learner-1"]);
    const learner = exported.learners[0]!;
    expect(learner).toMatchObject({ level: "intermediate", project: "traffic-light" });
    expect(learner.answers).toHaveLength(8);
    expect(learner.answers.find((a) => a.questionId === ledQ.id)).toMatchObject({
      chosen: "The cathode (shorter leg)",
      isCorrect: false,
      misconceptionId: "led-polarity-reversed",
      correctIndex: ledQ.correct,
    });
    expect(learner.attempts[0]).toMatchObject({ stageId: "traffic-leds", attempt: 1, score: 80, passed: true, quizSource: "local", planKind: "first" });
    for (const secret of ["Sara", "Student", "الطالب", "Traffic light", "إشارة المرور", "test-key", "VITE_GEMINI"]) expect(json).not.toContain(secret);
    const key = (import.meta.env.VITE_GEMINI_API_KEY ?? "").trim();
    if (key) expect(json).not.toContain(key);
  });

  it("labels learners by position only and keeps both when both have data", () => {
    demoData();
    const exported = anonymizedExport(readLearnerJourneys());
    expect(exported.learners.map((l) => l.learner)).toEqual(["learner-1", "learner-2"]);
    expect(exported.learners[0]!.attempts.map((a) => a.planKind)).toEqual(["first", "retry"]);
    expect(exported.learners[0]!.answers.filter((a) => a.misconceptionId).map((a) => a.misconceptionId).sort()).toEqual([
      "led-polarity-reversed",
      "ohms-law-units",
    ]);
  });
});

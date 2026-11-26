import { ApiError, type GenerateContentParameters } from "@google/genai";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { aiCacheEntries, clearAiCache, getAiCache, reloadAiCache } from "../lib/ai/cache";
import { DEMO_COMPONENT, DEMO_SCRIPT, demoCircuit, demoSteps, isCached, prepareDemo, scriptedAnswers } from "../lib/ai/demo";
import { buildLocalQuiz, planNextQuiz, START_DIFFICULTY } from "../lib/journey/adaptive";
import { catalogMatch, lookupComponent, type ComponentContext } from "../lib/journey/componentAi";
import { feedbackSignature, prepareFeedback, validateFeedback, type FeedbackContext } from "../lib/journey/feedbackAi";
import { gradeQuiz, stageStatuses } from "../lib/journey/grading";
import { assessLevel, validateLevelAssessment } from "../lib/journey/levelAi";
import { cachedLesson, lessonContext, localLesson, prepareLesson, validateLesson, type StageLesson } from "../lib/journey/lessonAi";
import { aiCallLogs, clearAiCallLogs } from "../lib/suggest/diagnostics";
import { levelQuestions } from "../lib/journey/level";
import { mentorCheckpoint, stageOrder } from "../lib/journey/mentor";
import { validatePlan } from "../lib/journey/mentorAi";
import { buildPath, stagePrerequisites } from "../lib/journey/path";
import { mentorContext, prepareMentorInsight, preparePersonalizedQuiz } from "../lib/journey/personalize";
import { basics, learningProjects } from "../lib/journey/projects";
import {
  readJourney,
  recordQuizResult,
  resetDemo,
  saveMentorInsight,
  setJourneyLanguage,
  setJourneyLevel,
  startLearningJourney,
} from "../lib/journey/store";
import type { Diagnosis, PersonalizedQuiz } from "../lib/journey/types";
import { validate } from "../lib/lab/validate";
import { explainWiring, validateWiringHelp, type WiringContext } from "../lib/lab/wiringAi";
import type { AiClient } from "../lib/suggest/aiEngine";
import type { AiConfig } from "../lib/suggest/config";
import { STORAGE_KEYS } from "../lib/storage";
import { LEARNER_ID } from "../lib/learner";

const config: AiConfig = { apiKey: "test-key", model: "gemini-3.5-flash", timeoutMs: 5_000 };
const noKey: AiConfig = { ...config, apiKey: "" };
const allCorrect = levelQuestions.map((q) => q.correct);
const response = (body: unknown) => {
  const text = typeof body === "string" ? body : JSON.stringify(body);
  return { text, candidates: [{ finishReason: "STOP", content: { role: "model", parts: [{ text }] } }] };
};
function fakeClient(generate: (params: GenerateContentParameters) => Promise<unknown>) {
  const spy = vi.fn(generate);
  return { client: { models: { generateContent: spy } } as unknown as AiClient, spy };
}
const failing = () => fakeClient(async () => { throw new Error("must not be called"); });
const contentsOf = (params: GenerateContentParameters) => String(params.contents);
const systemOf = (params: GenerateContentParameters) => String(params.config?.systemInstruction);

const AR = {
  goal: "تتعلّم في هذه المرحلة توصيل الـLED في الاتجاه الصحيح مع مقاومة مناسبة.",
  explanation:
    "يمر التيار في الـLED في اتجاه واحد فقط: من الأنود (الطرف الأطول) إلى الكاثود (الطرف الأقصر). لذلك يجب أن نضع الأنود باتجاه المنفذ والكاثود باتجاه GND. نحتاج أيضاً مقاومة على التوالي لتحديد التيار، وإلا قد يتلف الـLED أو المنفذ. مع منفذ 5 V ومقاومة 220 Ω يكون التيار آمناً ومناسباً.",
  analogy: "الـLED مثل باب يفتح في اتجاه واحد فقط، والمقاومة مثل حارس ينظم الدخول.",
  practiceTask: "في 3D Lab وصّل D9 بمقاومة 220 Ω ثم بطرف ANODE، ووصّل CATHODE بـGND ثم شغّل Validate Wiring.",
};

/** A fake Gemini that answers every feature validly from the request it receives. */
function smartGemini() {
  let n = 0;
  return fakeClient(async (params) => {
    const system = systemOf(params);
    const contents = contentsOf(params);
    n += 1;
    if (system.includes("You place an electronics learner")) {
      const level = /<rule_based_result>level (\w+)/.exec(contents)![1] as keyof typeof START_DIFFICULTY;
      return response({ level, difficulty: START_DIFFICULTY[level], reason: "إجاباتك تُظهر فهماً جيداً للأساسيات، لذا نبدأ بمستوى مناسب لك." });
    }
    if (system.includes("You analyse one electronics learner")) {
      const allowed = /Allowed skill tags: (.*)/.exec(contents)![1]!.split(", ");
      const weak = [...new Set([...contents.matchAll(/^- \[([^·\]]+) · [^\n]*→ wrong$/gm)].map((m) => m[1]!.trim()))].filter((s) => allowed.includes(s));
      const ids = [...contents.matchAll(/^- ([a-z-]+) \| /gm)].map((m) => m[1]!);
      const count = Number(/<answer_records count="(\d+)">/.exec(contents)![1]);
      return response({
        diagnosis: {
          summary: "ملخص التحليل.",
          strengths: [],
          weakSkills: weak,
          misconceptions: weak.map((s) => ({ skill: s, text: `فهم غير دقيق لـ${s}` })),
          confidence: count < 6 ? "low" : "medium",
          confidenceNote: "ملاحظة الثقة.",
        },
        plan: { items: ids.map((id) => ({ kind: "stage", target: id, action: "keep", reason: "سبب.", explanation: "" })), changeNote: "ملاحظة التغيير." },
      });
    }
    if (system.includes("You write one short electronics lesson")) return response(AR);
    if (system.includes("personalized electronics quizzes")) {
      const focus = /Focus skills: (.*)/.exec(contents)![1]!.split(", ");
      const allowed = /Allowed skills: (.*)/.exec(contents)![1]!.split(", ");
      const review = /Review skill: (.+?) \(/.exec(contents)?.[1];
      const difficulty = /Difficulty: (\w+)/.exec(contents)![1];
      const skills = [focus[0]!, focus[1] ?? focus[0]!, ...(review ? [review] : []), ...allowed].slice(0, 5);
      return response({
        explanation: "شرح مخصص لنقاط ضعفك.",
        practiceTask: "تمرين في 3D Lab مع GND.",
        questions: skills.map((skill, i) => ({
          prompt: `سؤال ${n}-${i} عن ${skill}`,
          options: [`أ${n}${i}`, `ب${n}${i}`, `ج${n}${i}`, `د${n}${i}`],
          correctIndex: i % 4,
          explanation: "شرح قصير.",
          skill,
          difficulty,
        })),
      });
    }
    if (system.includes("A learner just failed a stage quiz")) {
      const indexes = [...contents.matchAll(/^- #(\d+) \[/gm)].map((m) => Number(m[1]));
      return response({
        mistakes: indexes.map((index) => ({ index, misconception: "يظن أن الطرف القصير يوصل بالموجب." })),
        explanation: "الأنود هو الطرف الأطول ويتجه نحو المنفذ، والكاثود يتجه نحو GND، وهكذا يضيء الـLED.",
        practiceTask: "في 3D Lab اعكس الـLED ثم شغّل Validate Wiring.",
      });
    }
    if (system.includes("wiring mentor")) {
      const indexes = [...contents.matchAll(/^- #(\d+) \[/gm)].map((m) => Number(m[1]));
      return response({
        notes: indexes.map((index) => ({ index, explanation: "هذا السلك يربط طرف تغذية بطرف إشارة.", fix: "انقل السلك من 5V إلى المكان الصحيح." })),
        summary: "في الدائرة مشكلتان في التوصيل.",
      });
    }
    if (system.includes("You describe an electronics part")) return response(componentBody());
    throw new Error(`unexpected request: ${system.slice(0, 60)}`);
  });
}

function componentBody(change: (b: Record<string, unknown>) => void = () => {}) {
  const body: Record<string, unknown> = {
    name: "TM1637 4-digit display",
    whatItIs: "وحدة عرض بأربع خانات بسبعة مقاطع مع شريحة تحكم TM1637.",
    typicalPins: [
      { name: "CLK", function: "خط الساعة" },
      { name: "DIO", function: "خط البيانات" },
      { name: "VCC", function: "التغذية" },
      { name: "GND", function: "الأرضي" },
    ],
    voltage: "3.3–5 V (varies by module)",
    typicalUse: "عرض الأرقام مثل العدّاد أو الساعة في المشاريع الصغيرة.",
    projectFit: "يمكن أن تعرض العدّ التنازلي لعبور المشاة في إشارة المرور.",
    safetyNotes: ["افصل التغذية قبل تغيير التوصيلات."],
  };
  change(body);
  return body;
}

function setup(project: "traffic-light" | "parking-sensor" = "traffic-light") {
  startLearningJourney(project);
  setJourneyLevel("intermediate", 3, allCorrect);
  return { stages: buildPath(readJourney()) };
}

beforeEach(() => {
  localStorage.clear();
  resetDemo();
  clearAiCache();
  vi.stubGlobal("fetch", vi.fn(() => { throw new Error("Network access is disabled in tests"); }));
});
afterEach(() => vi.unstubAllGlobals());

describe("AI level check", () => {
  const ctx = { rating: 1, answers: allCorrect, language: "ar" as const };
  it("uses a valid Gemini level and difficulty, cached per answers", async () => {
    const { client, spy } = fakeClient(async () => response({ level: "advanced", difficulty: "medium", reason: "أجبت عن كل الأسئلة بشكل صحيح وتملك خبرة جيدة." }));
    const result = await assessLevel({ learnerId: LEARNER_ID, ...ctx, config, client });
    expect(result).toMatchObject({ level: "advanced", difficulty: "medium", source: "ai", score: 4 });
    reloadAiCache();
    expect(await assessLevel({ learnerId: LEARNER_ID, ...ctx, config: noKey, client: failing().client })).toEqual(result);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(params(spy).config?.httpOptions?.retryOptions).toBeUndefined();
  });
  it.each([
    ["an unknown level", { level: "expert", difficulty: "hard", reason: "سبب كافٍ للتقييم هنا." }],
    ["two steps from the rules", { level: "beginner", difficulty: "easy", reason: "سبب كافٍ للتقييم هنا." }],
    ["a difficulty far from the level", { level: "advanced", difficulty: "easy", reason: "سبب كافٍ للتقييم هنا." }],
    ["an English reason in Arabic mode", { level: "intermediate", difficulty: "medium", reason: "All answers were correct." }],
  ])("rejects %s and uses the score thresholds", async (_, body) => {
    // Rating 2 + 3 correct = advanced by the rules.
    const strict = { ...ctx, rating: 2 };
    expect(validateLevelAssessment(body, strict)).toBeNull();
    const result = await assessLevel({ learnerId: "a", ...strict, config, client: fakeClient(async () => response(body)).client });
    expect(result).toMatchObject({ source: "local", fallbackReason: "bad-response", level: "advanced", difficulty: "hard" });
  });
  it("falls back without a key (no request) and on the free limit", async () => {
    const { client, spy } = fakeClient(async () => { throw new ApiError({ status: 429, message: "RESOURCE_EXHAUSTED" }); });
    expect(await assessLevel({ learnerId: LEARNER_ID, ...ctx, config: noKey, client })).toMatchObject({ source: "local", fallbackReason: "missing-key", level: "intermediate" });
    expect(spy).not.toHaveBeenCalled();
    expect(await assessLevel({ learnerId: LEARNER_ID, ...ctx, config, client })).toMatchObject({ source: "local", fallbackReason: "rate-limit" });
  });
});
const params = (spy: ReturnType<typeof fakeClient>["spy"], i = 0) => spy.mock.calls[i]![0];

describe("AI-written lessons", () => {
  it("uses a valid lesson grounded in the stage data, and caches it", async () => {
    const { stages } = setup();
    const ctx = lessonContext(readJourney(), stages[0]!);
    const { client, spy } = fakeClient(async () => response(AR));
    const lesson = await prepareLesson({ learnerId: "a", ctx, config, client });
    expect(lesson).toMatchObject({ ...AR, source: "ai" });
    expect(contentsOf(params(spy))).toContain("ANODE (passive)");
    expect(contentsOf(params(spy))).toContain(stages[0]!.explanation);
    expect(cachedLesson("a", ctx)).toEqual(lesson);
    expect(cachedLesson("b", ctx)).toBeNull();
    await prepareLesson({ learnerId: "a", ctx, config, client });
    expect(spy).toHaveBeenCalledTimes(1);
  });
  it.each<[string, Partial<typeof AR>, (lesson: StageLesson, local: ReturnType<typeof localLesson>) => void]>([
    ["an explanation that is too long", { explanation: "هذا شرح طويل جداً عن الـLED والمقاومة. ".repeat(60) }, (l) => {
      expect(l.explanation.length).toBeLessThanOrEqual(1600);
      expect(l.explanation.endsWith(".")).toBe(true);
      expect(l.localFields).toEqual([]);
    }],
    ["a practice task without a real pin name", { practiceTask: "في 3D Lab جرّب توصيل القطع بطريقة صحيحة ثم تحقّق منها." }, (l, local) => {
      expect(l.practiceTask).toBe(local.practiceTask);
      expect(l.localFields).toEqual(["practiceTask"]);
      expect(l.explanation).toBe(AR.explanation);
    }],
    ["a missing goal", { goal: "" }, (l, local) => {
      expect(l.goal).toBe(local.goal);
      expect(l.localFields).toEqual(["goal"]);
    }],
    ["a too-short analogy", { analogy: "باب." }, (l, local) => expect(l.analogy).toBe(local.analogy)],
  ])("repairs a lesson with %s and keeps the AI lesson", async (_, change, check) => {
    const { stages } = setup();
    const ctx = lessonContext(readJourney(), stages[0]!);
    expect(validateLesson({ ...AR, ...change }, ctx).value).not.toBeNull();
    const lesson = await prepareLesson({ learnerId: "a", ctx, config, client: fakeClient(async () => response({ ...AR, ...change })).client });
    expect(lesson.source).toBe("ai");
    check(lesson, localLesson(stages[0]!, "ar"));
    // The repaired lesson is cached and validates again on reuse, with the same local fields.
    expect(cachedLesson("a", ctx)).toEqual(lesson);
  });
  it.each<[string, Partial<typeof AR>, string]>([
    ["a part outside the project", { explanation: `${AR.explanation} استخدم HC-SR04 Ultrasonic Sensor أيضاً.` }, "outside the project"],
    ["English text in Arabic mode", { goal: "Connect the LED the right way round." }, "goal is in the wrong language"],
    ["a link", { analogy: "اقرأ المزيد على https://example.com لأن الشرح هناك أوضح." }, "analogy contains a link"],
    ["a missing explanation", { explanation: "" }, "explanation is missing"],
    ["a too-short explanation", { explanation: "شرح قصير." }, "explanation is too short"],
  ])("still rejects a lesson with %s and shows the prewritten lesson", async (_, change, rule) => {
    const { stages } = setup();
    const ctx = lessonContext(readJourney(), stages[0]!);
    expect(validateLesson({ ...AR, ...change }, ctx).rejected.join(" ")).toContain(rule);
    clearAiCallLogs();
    const lesson = await prepareLesson({ learnerId: "a", ctx, config, client: fakeClient(async () => response({ ...AR, ...change })).client });
    expect(lesson).toEqual({ ...localLesson(stages[0]!, "ar"), source: "local", fallbackReason: "bad-response" });
    expect(aiCallLogs()[0]!.detail).toContain(rule);
  });
  it("falls back to local content offline and without a key", async () => {
    const { stages } = setup();
    const ctx = lessonContext(readJourney(), stages[0]!);
    expect(await prepareLesson({ learnerId: "a", ctx, config: noKey })).toMatchObject({ source: "local", fallbackReason: "missing-key" });
    const offline = fakeClient(async () => { throw new TypeError("Failed to fetch"); });
    expect(await prepareLesson({ learnerId: "a", ctx, config, client: offline.client })).toMatchObject({ source: "local", fallbackReason: "network" });
  });
});

function failedQuiz() {
  const { stages } = setup();
  const state = readJourney();
  const quiz = buildLocalQuiz(stages, 0, planNextQuiz(stages, 0, state.profile!, {}), state.profile!, "a", "ar");
  const answers = scriptedAnswers(quiz.questions, "LED polarity", 2);
  recordQuizResult(stages[0]!.id, quiz, answers, gradeQuiz(quiz, answers));
  const ctx: FeedbackContext = { stage: stages[0]!, quiz, answers, profile: readJourney().profile!, language: "ar", projectParts: readJourney().parts.map((p) => p.key) };
  return { ctx, quiz, wrong: answers.flatMap((a, i) => (a === quiz.questions[i]!.correct ? [] : [i])) };
}
const feedbackBody = (wrong: number[]) => ({
  mistakes: wrong.map((index) => ({ index, misconception: "يظن أن الطرف القصير يوصل بالموجب." })),
  explanation: "الأنود هو الطرف الأطول ويتجه نحو المنفذ، والكاثود يتجه نحو GND، وهكذا يضيء الـLED.",
  practiceTask: "في 3D Lab اعكس الـLED ثم شغّل Validate Wiring.",
});

describe("AI feedback on a failed quiz", () => {
  it("explains the misconception behind each wrong answer from the chosen option", async () => {
    const { ctx, wrong } = failedQuiz();
    expect(wrong).toHaveLength(2);
    const { client, spy } = fakeClient(async () => response(feedbackBody(wrong)));
    const feedback = await prepareFeedback({ learnerId: "a", ctx, config, client });
    expect(feedback.source).toBe("ai");
    expect(feedback.mistakes.map((m) => m.index)).toEqual(wrong);
    const prompt = contentsOf(params(spy));
    const q = ctx.quiz.questions[wrong[0]!]!;
    expect(prompt).toContain(`chose "${q.options[ctx.answers[wrong[0]!]!]}", correct "${q.options[q.correct]}"`);
    // Same wrong choices: cached. Different choices: a new request.
    await prepareFeedback({ learnerId: "a", ctx, config, client });
    expect(spy).toHaveBeenCalledTimes(1);
    const other = [...ctx.answers];
    other[wrong[0]!] = (ctx.quiz.questions[wrong[0]!]!.correct + 2) % 4;
    expect(feedbackSignature({ ...ctx, answers: other })).not.toBe(feedbackSignature(ctx));
    await prepareFeedback({ learnerId: "a", ctx: { ...ctx, answers: other }, config, client });
    expect(spy).toHaveBeenCalledTimes(2);
  });
  it.each<[string, (wrong: number[]) => unknown]>([
    ["a wrong answer left out", (wrong) => feedbackBody(wrong.slice(1))],
    ["a note on a right answer", (wrong) => feedbackBody([...wrong, [0, 1, 2, 3, 4].find((i) => !wrong.includes(i))!])],
    ["English in Arabic mode", (wrong) => ({ ...feedbackBody(wrong), explanation: "The anode is the longer leg and goes to the pin." })],
    ["a part outside the project", (wrong) => ({ ...feedbackBody(wrong), practiceTask: "في 3D Lab أضف HC-SR04 Ultrasonic Sensor." })],
  ])("rejects feedback with %s and uses the local rules", async (_, body) => {
    const { ctx, wrong } = failedQuiz();
    expect(validateFeedback(body(wrong), ctx)).toBeNull();
    const feedback = await prepareFeedback({ learnerId: "a", ctx, config, client: fakeClient(async () => response(body(wrong))).client });
    expect(feedback).toMatchObject({ source: "local", fallbackReason: "bad-response" });
    expect(feedback.mistakes.map((m) => m.index)).toEqual(wrong);
  });
  it("falls back on the free limit with rule-based notes", async () => {
    const { ctx, wrong } = failedQuiz();
    const limited = fakeClient(async () => { throw new ApiError({ status: 429, message: "quota" }); });
    const feedback = await prepareFeedback({ learnerId: "a", ctx, config, client: limited.client });
    expect(feedback).toMatchObject({ source: "local", fallbackReason: "rate-limit" });
    expect(feedback.mistakes).toHaveLength(wrong.length);
    expect(feedback.explanation).toBe(ctx.stage.ar.mentor.alternative);
  });
});

describe("AI stage ordering", () => {
  const diagnosis: Diagnosis = { summary: "ملخص.", strengths: [], weakSkills: [], misconceptions: [], confidence: "low", confidenceNote: "قليل." };
  const plan = (ids: string[]) => ({ items: ids.map((id) => ({ kind: "stage", target: id, action: "keep", reason: "سبب.", explanation: "" })), changeNote: "ملاحظة." });

  it("declares prerequisites: independent part stages, and basics first for beginners", () => {
    const parking = learningProjects.find((p) => p.id === "parking-sensor")!.stages;
    expect(stagePrerequisites(parking)).toEqual({ "parking-distance": [], "parking-buzzer": [], "parking-warning": ["parking-distance", "parking-buzzer"] });
    const traffic = learningProjects.find((p) => p.id === "traffic-light")!.stages;
    expect(stagePrerequisites([basics, ...traffic])["traffic-timing"]).toEqual(["basics", "traffic-leds"]);
  });

  it("applies a valid reorder of independent stages; locking follows it with the same rule", async () => {
    setup("parking-sensor");
    const order = ["parking-buzzer", "parking-distance", "parking-warning"];
    const { client } = fakeClient(async () => response({ diagnosis, plan: plan(order) }));
    const state = readJourney();
    saveMentorInsight((await prepareMentorInsight({ state, stages: buildPath(state), learnerId: "a", config, client }))!);
    const stages = buildPath(readJourney());
    expect(stages.map((s) => s.id)).toEqual(order);
    expect(stageStatuses(stages, readJourney().progress)).toEqual(["current", "locked", "locked"]);
  });

  it("repairs broken prerequisites, moved attempted stages and a changed order within a checkpoint", async () => {
    setup("parking-sensor");
    const base = readJourney();
    const stages = buildPath(base);
    const ctx = mentorContext(base, stages, mentorCheckpoint(base, stages)!);
    const ids = (r: ReturnType<typeof validatePlan>) => r.value?.items.map((i) => i.target);
    // The warning stage needs both others: it moves after them, keeping Gemini's order otherwise.
    const broken = validatePlan(plan(["parking-warning", "parking-buzzer", "parking-distance"]), ctx, diagnosis);
    expect(ids(broken)).toEqual(["parking-buzzer", "parking-distance", "parking-warning"]);
    expect(broken.repaired.join(" ")).toContain("order fixed");
    // An attempted stage stays first.
    const attempted = { ...ctx, progress: { "parking-distance": { attempts: 1, passed: false, bestScore: 40, lastScore: 40 } } };
    expect(ids(validatePlan(plan(["parking-buzzer", "parking-distance", "parking-warning"]), attempted, diagnosis))).toEqual([
      "parking-distance",
      "parking-buzzer",
      "parking-warning",
    ]);
    // A second language keeps the order already chosen at this checkpoint.
    const locked = { ...ctx, lockedOrder: ["parking-buzzer", "parking-distance", "parking-warning"] };
    expect(ids(validatePlan(plan(["parking-distance", "parking-buzzer", "parking-warning"]), locked, diagnosis))).toEqual(locked.lockedOrder);
    // Unknown stages are still rejected.
    expect(validatePlan(plan(["parking-buzzer", "parking-teleport"]), ctx, diagnosis).rejected).toEqual(["unknown stage: parking-teleport"]);
  });

  it("keeps the current order on fallback, and ignores a stored order that is no longer safe", async () => {
    setup("parking-sensor");
    const order = ["parking-buzzer", "parking-distance", "parking-warning"];
    const state = readJourney();
    saveMentorInsight((await prepareMentorInsight({ state, stages: buildPath(state), learnerId: "a", config, client: fakeClient(async () => response({ diagnosis, plan: plan(order) })).client }))!);
    setJourneyLanguage("en");
    const now = readJourney();
    const local = (await prepareMentorInsight({ state: now, stages: buildPath(now), learnerId: "a", config: noKey }))!;
    expect(local.source).toBe("local");
    expect(stageOrder(local.plan.items)).toEqual(order);
    const unsafe = { ...now, mentor: { ...now.mentor!, order: ["parking-warning", "parking-buzzer", "parking-distance"] } };
    expect(buildPath(unsafe).map((s) => s.id)).toEqual(["parking-distance", "parking-buzzer", "parking-warning"]);
  });
});

describe("AI wiring help in the 3D Lab", () => {
  const ctxOf = (): WiringContext => {
    const circuit = demoCircuit();
    return { issues: validate(circuit).issues, circuit, language: "ar", projectTitle: "Traffic light", projectParts: ["arduino_uno", "led_red"] };
  };
  const body = (ctx: WiringContext) => ({
    notes: ctx.issues.map((_, index) => ({ index, explanation: "هذا السلك يربط طرف تغذية بطرف إشارة.", fix: "انقل السلك من 5V إلى المكان الصحيح." })),
    summary: "في الدائرة مشكلات في التوصيل.",
  });
  it("explains every rule result in context without changing the circuit", async () => {
    const ctx = ctxOf();
    expect(ctx.issues.map((i) => i.type)).toContain("Wrong Pin Type");
    const before = structuredClone(ctx.circuit);
    const { client, spy } = fakeClient(async () => response(body(ctx)));
    const help = await explainWiring({ learnerId: "a", ctx, config, client });
    expect(help.source).toBe("ai");
    expect(help.notes).toHaveLength(ctx.issues.length);
    expect(ctx.circuit).toEqual(before);
    expect(contentsOf(params(spy))).toContain("Power pin wired to signal pin");
    await explainWiring({ learnerId: "a", ctx, config, client });
    expect(spy).toHaveBeenCalledTimes(1);
  });
  it.each<[string, (ctx: WiringContext) => unknown]>([
    ["a problem left out", (ctx) => ({ ...body(ctx), notes: body(ctx).notes.slice(1) })],
    ["a part outside the circuit and project", (ctx) => ({ ...body(ctx), summary: "استخدم HC-SR04 Ultrasonic Sensor بدلاً من ذلك." })],
    ["a link", (ctx) => ({ ...body(ctx), summary: "اقرأ www.example.com لمعرفة المزيد عن التوصيل." })],
  ])("rejects help with %s and keeps the existing explanations", async (_, make) => {
    const ctx = ctxOf();
    expect(validateWiringHelp(make(ctx), ctx)).toBeNull();
    const help = await explainWiring({ learnerId: "a", ctx, config, client: fakeClient(async () => response(make(ctx))).client });
    expect(help).toMatchObject({ source: "local", fallbackReason: "bad-response" });
    expect(help.notes.map((n) => n.explanation)).toEqual(ctx.issues.map((i) => i.message));
  });
  it("falls back without a key", async () => {
    expect(await explainWiring({ learnerId: "a", ctx: ctxOf(), config: noKey })).toMatchObject({ source: "local", fallbackReason: "missing-key" });
  });
});

describe("AI new component information", () => {
  const ctx: ComponentContext = { name: DEMO_COMPONENT, language: "ar", projectTitle: "Traffic light", projectParts: ["arduino_uno"] };
  it("returns structured information for a part outside the catalog, and caches it", async () => {
    const { client, spy } = fakeClient(async () => response(componentBody()));
    const result = await lookupComponent({ learnerId: "a", ctx, config, client });
    expect(result.kind).toBe("ai");
    expect(result.kind === "ai" && result.info.typicalPins.map((p) => p.name)).toEqual(["CLK", "DIO", "VCC", "GND"]);
    await lookupComponent({ learnerId: "a", ctx: { ...ctx, name: "  tm1637 4-digit   DISPLAY " }, config, client });
    expect(spy).toHaveBeenCalledTimes(1);
    expect(systemOf(params(spy))).toContain("Never give links");
  });
  it("shows catalog parts from local data without a request", async () => {
    const { client, spy } = failing();
    expect(catalogMatch("HC-SR04")?.key).toBe("hc_sr04");
    expect((await lookupComponent({ learnerId: "a", ctx: { ...ctx, name: "hc-sr04" }, config, client })).kind).toBe("catalog");
    expect(spy).not.toHaveBeenCalled();
    expect((await lookupComponent({ learnerId: "a", ctx: { ...ctx, name: "x" }, config, client })).kind).toBe("invalid-name");
  });
  it.each<[string, (b: Record<string, unknown>) => void]>([
    ["a datasheet link", (b) => (b["typicalUse"] = "التفاصيل في https://example.com/tm1637.pdf للمشاريع.")],
    ["no pins", (b) => (b["typicalPins"] = [])],
    ["too many safety notes", (b) => (b["safetyNotes"] = Array.from({ length: 6 }, (_, i) => `ملاحظة سلامة رقم ${i}`))],
    ["English prose in Arabic mode", (b) => (b["whatItIs"] = "A four-digit seven-segment display module.")],
  ])("rejects information with %s and invents nothing", async (_, change) => {
    const result = await lookupComponent({ learnerId: "a", ctx, config, client: fakeClient(async () => response(componentBody(change))).client });
    expect(result).toEqual({ kind: "none", fallbackReason: "bad-response" });
  });
  it("falls back without a key", async () => {
    expect(await lookupComponent({ learnerId: "a", ctx, config: noKey })).toEqual({ kind: "none", fallbackReason: "missing-key" });
  });
});

describe("demo cache and Demo readiness", () => {
  it("lists the 11 demo results and prepares the missing ones one request at a time", async () => {
    const steps = demoSteps("ar");
    expect(steps).toHaveLength(11);
    expect(steps.every((s) => !isCached(s, "ar"))).toBe(true);
    const { client, spy } = smartGemini();
    const sleep = vi.fn(async () => {});
    const progress: string[] = [];
    const result = await prepareDemo({ language: "ar", config, client, sleep, pauseMs: 1, onProgress: (p) => progress.push(`${p.step.feature}:${p.status}`) });
    expect(result).toEqual({ requests: 11, stopped: null });
    expect(spy).toHaveBeenCalledTimes(11);
    expect(sleep).toHaveBeenCalledTimes(10);
    expect(progress.filter((p) => p.endsWith(":requesting"))).toHaveLength(11);
    // Every entry belongs to the single learner.
    expect(new Set(aiCacheEntries().map((e) => e.learner))).toEqual(new Set([LEARNER_ID]));
    expect(progress.filter((p) => !p.endsWith(":requesting")).every((p) => p.endsWith(":prepared"))).toBe(true);
    expect(demoSteps("ar").every((s) => isCached(s, "ar"))).toBe(true);
    // A second run sends nothing.
    const again = await prepareDemo({ language: "ar", config, client: failing().client, sleep });
    expect(again).toEqual({ requests: 0, stopped: null });
  });

  it("survives a reload and Reset demo, and only Clear AI cache removes it", async () => {
    await prepareDemo({ language: "ar", config, client: smartGemini().client, sleep: async () => {} });
    const count = aiCacheEntries().length;
    expect(count).toBe(11);
    resetDemo();
    reloadAiCache();
    expect(aiCacheEntries()).toHaveLength(count);
    expect(localStorage.getItem(STORAGE_KEYS.aiCache)).not.toBeNull();
    clearAiCache();
    expect(aiCacheEntries()).toHaveLength(0);
  });

  it("the scripted demo then reuses the cache in the real journey, even without a key", async () => {
    await prepareDemo({ language: "ar", config, client: smartGemini().client, sleep: async () => {} });
    const script = DEMO_SCRIPT;
    const level = await assessLevel({ learnerId: LEARNER_ID, rating: script.rating, answers: script.levelAnswers, language: "ar", config: noKey });
    expect(level.source).toBe("ai");
    startLearningJourney("traffic-light");
    setJourneyLevel(level.level, level.score, script.levelAnswers, level.difficulty);
    const stages = buildPath(readJourney());
    const insight = (await prepareMentorInsight({ state: readJourney(), stages, learnerId: LEARNER_ID, config: noKey }))!;
    expect(insight.source).toBe("ai");
    saveMentorInsight(insight);
    const quiz: PersonalizedQuiz = await preparePersonalizedQuiz({ state: readJourney(), stages, index: 0, learnerId: LEARNER_ID, config: noKey });
    expect(quiz.source).toBe("ai");
    expect(cachedLesson(LEARNER_ID, lessonContext(readJourney(), stages[0]!))?.source).toBe("ai");
    expect(getAiCache(LEARNER_ID, "level", demoSteps("ar")[0]!.checkpoint, "ar")).not.toBeNull();
  });

  it("stops at the free limit without retrying", async () => {
    const smart = smartGemini();
    let calls = 0;
    const { client, spy } = fakeClient(async (p) => {
      calls += 1;
      if (calls === 3) throw new ApiError({ status: 429, message: "RESOURCE_EXHAUSTED" });
      return smart.client.models.generateContent(p);
    });
    const result = await prepareDemo({ language: "ar", config, client, sleep: async () => {} });
    expect(result).toEqual({ requests: 3, stopped: "rate-limit" });
    expect(spy).toHaveBeenCalledTimes(3);
    expect(demoSteps("ar").filter((s) => isCached(s, "ar"))).toHaveLength(2);
  });

  it("prepares nothing without a key", async () => {
    const { client, spy } = smartGemini();
    expect(await prepareDemo({ language: "ar", config: noKey, client, sleep: async () => {} })).toEqual({ requests: 0, stopped: "missing-key" });
    expect(spy).not.toHaveBeenCalled();
  });
});

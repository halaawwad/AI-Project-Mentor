import { catalogByKey } from "@/lib/componentCatalog";
import { componentCheckpoint, lookupComponent } from "@/lib/journey/componentAi";
import { feedbackCheckpoint, prepareFeedback } from "@/lib/journey/feedbackAi";
import { gradeQuiz } from "@/lib/journey/grading";
import { assessLevel, levelCheckpoint, validateLevelAssessment } from "@/lib/journey/levelAi";
import { lessonCheckpoint, lessonContext, prepareLesson } from "@/lib/journey/lessonAi";
import { levelQuestions, scoreLevel } from "@/lib/journey/level";
import { withInsight } from "@/lib/journey/mentor";
import { buildPath } from "@/lib/journey/path";
import { prepareMentorInsight, preparePersonalizedQuiz, quizCheckpoint } from "@/lib/journey/personalize";
import { learningJourney, withLevel, withQuizResult } from "@/lib/journey/store";
import { LEARNER_ID } from "@/lib/learner";
import type { Bi, JourneyState, Language, Question, Stage } from "@/lib/journey/types";
import { explainWiring, wiringCheckpoint } from "@/lib/lab/wiringAi";
import type { CircuitData } from "@/lib/lab/types";
import { validate } from "@/lib/lab/validate";
import { suggestParts, suggestionsCheckpoint } from "@/lib/suggest";
import type { AiClient } from "@/lib/suggest/aiEngine";
import type { AiConfig } from "@/lib/suggest/config";
import { exampleProjects } from "@/lib/suggest/examples";
import type { FallbackReason } from "@/lib/suggest/types";
import { getAiCache, type AiFeature } from "./cache";

/**
 * The scripted demo (traffic light, one learner). The presenter follows the same rules, so the
 * cached results match; a cached result is still validated against the real answers before use.
 * Personalization is shown live by answering differently (that makes one live request instead).
 */
export interface DemoScript {
  rating: number;
  /** Placement answers (option indexes). */
  levelAnswers: number[];
  /** The skill the scripted answers get wrong in quizzes. */
  focus: string;
}

/** The first option that isn't the correct one: the scripted wrong choice. */
export const scriptedWrong = (q: Question) => (q.correct === 0 ? 1 : 0);

export const DEMO_SCRIPT: DemoScript = {
  rating: 1,
  levelAnswers: levelQuestions.map((q) => q.correct),
  focus: "LED polarity",
};

/**
 * Scripted quiz answers: `wrong` questions answered with the first wrong option, questions on the
 * learner's focus skill first, then the earliest others; everything else right.
 */
export function scriptedAnswers(questions: Question[], focus: string, wrong: number) {
  const order = [...questions.keys()].sort(
    (a, b) => Number(questions[b]!.skill === focus) - Number(questions[a]!.skill === focus) || a - b,
  );
  const missed = new Set(order.slice(0, wrong));
  return questions.map((q, i) => (missed.has(i) ? scriptedWrong(q) : q.correct));
}

/** Demo circuit for "Explain with mentor": an Arduino Uno with 5V wired straight to D2. */
export function demoCircuit(): CircuitData {
  const uno = catalogByKey.get("arduino_uno")!.def;
  return {
    parts: [{ id: "demo-uno", type: uno.id, x: 0, z: 0, rot: 0 }],
    wires: [
      {
        id: "demo-wire",
        from: { partId: "demo-uno", pin: uno.pins.findIndex((p) => p.name === "5V") },
        to: { partId: "demo-uno", pin: uno.pins.findIndex((p) => p.name === "D2") },
        color: "#e5484d",
      },
    ],
  };
}
export const DEMO_COMPONENT = "TM1637 4-digit display";

export interface DemoStep {
  feature: AiFeature;
  checkpoint: string;
  label: Bi;
}

const projectOf = (language: Language) => learningJourney("traffic-light", language)!;

/** The level the demo path is built with: the cached AI level if valid, else the rule level. */
function demoLevel(script: DemoScript, language: Language) {
  const cached = getAiCache(LEARNER_ID, "level", levelCheckpoint(script.rating, script.levelAnswers), language);
  const valid = cached ? validateLevelAssessment(cached.value, { rating: script.rating, answers: script.levelAnswers, language }) : null;
  return valid?.level ?? scoreLevel(script.rating, script.levelAnswers).level;
}

/** Every AI result the scripted demo uses, in the order the demo reaches them. */
export function demoSteps(language: Language, script: DemoScript = DEMO_SCRIPT): DemoStep[] {
  {
    const level = demoLevel(script, language);
    const stages = buildPath({ ...projectOf(language), level });
    const [first, second] = stages;
    const step = (feature: AiFeature, checkpoint: string, en: string, ar: string): DemoStep => ({
      feature,
      checkpoint,
      label: { en, ar },
    });
    const circuit = demoCircuit();
    const suggestionProject = exampleProjects.find((example) => example.id === "countdown-timer")!;
    return [
      step("level", levelCheckpoint(script.rating, script.levelAnswers), "Level check", "تحديد المستوى"),
      step("mentor", "level", "Mentor analysis and plan after the level check", "تحليل المرشد والخطة بعد تحديد المستوى"),
      step("lesson", lessonCheckpoint(first!.id, level), `Lesson: ${first!.title.en}`, `الدرس: ${first!.title.ar}`),
      step("quiz", quizCheckpoint(first!.id, 0), `Quiz 1: ${first!.title.en}`, `الاختبار 1: ${first!.title.ar}`),
      step("feedback", feedbackCheckpoint(first!.id, 0), "Mentor feedback on the failed quiz", "ملاحظات المرشد على الاختبار غير المجتاز"),
      step("quiz", quizCheckpoint(first!.id, 1), `Retry quiz: ${first!.title.en}`, `اختبار الإعادة: ${first!.title.ar}`),
      step("mentor", `stage:${first!.id}`, "Mentor analysis and updated plan after stage 1", "تحليل المرشد والخطة بعد المرحلة 1"),
      ...(second
        ? [
            step("lesson", lessonCheckpoint(second.id, level), `Lesson: ${second.title.en}`, `الدرس: ${second.title.ar}`),
            step("quiz", quizCheckpoint(second.id, 0), `Quiz 1: ${second.title.en}`, `الاختبار 1: ${second.title.ar}`),
          ]
        : []),
      step("wiring", wiringCheckpoint({ issues: validate(circuit).issues }), "Explain with mentor (5V → D2 in the 3D Lab)", "اشرح مع المرشد (5V ← D2 في 3D Lab)"),
      step("component", componentCheckpoint(DEMO_COMPONENT), `New component: ${DEMO_COMPONENT}`, `قطعة جديدة: ${DEMO_COMPONENT}`),
      step(
        "suggestions",
        suggestionsCheckpoint(suggestionProject.description),
        suggestionProject.title.en,
        suggestionProject.title.ar,
      ),
    ];
  }
}

export const isCached = (step: DemoStep, language: Language) =>
  getAiCache(
    LEARNER_ID,
    step.feature,
    step.checkpoint,
    step.feature === "suggestions" ? "en" : language,
  ) !== null;

export type DemoProgress =
  | { step: DemoStep; status: "requesting" | "cached" | "prepared" }
  | { step: DemoStep; status: "fallback"; reason: FallbackReason };

/** Reasons that stop the run: retrying would fail the same way or waste the free limit. */
const STOP: FallbackReason[] = ["missing-key", "invalid-key", "permission", "rate-limit", "bad-request"];

/**
 * Prepares the missing demo results by walking the scripted demo, one request
 * at a time with a pause after each request. Cached steps cost nothing. Stops at the first
 * missing key, invalid key, permission, bad request or free-limit error (no retries).
 */
export async function prepareDemo({
  language,
  config,
  client,
  pauseMs = 4000,
  sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)),
  onProgress = () => {},
}: {
  language: Language;
  config?: AiConfig;
  client?: AiClient;
  pauseMs?: number;
  sleep?: (ms: number) => Promise<void>;
  onProgress?: (progress: DemoProgress) => void;
}): Promise<{ requests: number; stopped: FallbackReason | null }> {
  const ai = { ...(config ? { config } : {}), ...(client ? { client } : {}) };
  let requests = 0;
  const steps = demoSteps(language);
  const run = async <T>(step: DemoStep | undefined, call: () => Promise<T>, reasonOf: (r: T) => FallbackReason | undefined) => {
    if (!step) return call();
    const cached = isCached(step, language);
    if (cached) {
      const value = await call();
      onProgress({ step, status: "cached" });
      return value;
    }
    if (requests > 0) await sleep(pauseMs);
    onProgress({ step, status: "requesting" });
    const value = await call();
    const reason = reasonOf(value);
    if (reason !== "missing-key") requests += 1;
    if (reason) {
      onProgress({ step, status: "fallback", reason });
      if (STOP.includes(reason)) throw new DemoStop(reason);
    } else onProgress({ step, status: "prepared" });
    return value;
  };
  try {
    {
      const script = DEMO_SCRIPT;
      const at = (feature: AiFeature, checkpoint: string) => steps.find((s) => s.feature === feature && s.checkpoint === checkpoint);
      const learnerId = LEARNER_ID;
      const level = await run(at("level", levelCheckpoint(script.rating, script.levelAnswers)), () =>
        assessLevel({ learnerId, rating: script.rating, answers: script.levelAnswers, language, ...ai }), (r) => r.fallbackReason);
      let state: JourneyState = withLevel(projectOf(language), level.level, level.score, script.levelAnswers, level.difficulty);
      let stages: Stage[] = buildPath(state);
      const insight = async (checkpoint: string) => {
        const result = await run(at("mentor", checkpoint), () => prepareMentorInsight({ state, stages, learnerId, ...ai }), (r) => r?.fallbackReason);
        if (result) state = { ...state, mentor: withInsight(state.mentor, result) };
        stages = buildPath(state);
      };
      await insight("level");
      const first = stages[0]!;
      await run(at("lesson", lessonCheckpoint(first.id, state.level!)), () => prepareLesson({ learnerId, ctx: lessonContext(state, first), ...ai }), (r) => r.fallbackReason);
      const takeQuiz = async (stage: Stage, wrong: number) => {
        const index = stages.findIndex((s) => s.id === stage.id);
        const attempt = state.profile?.history[stage.id]?.attempts.length ?? 0;
        const quiz = await run(at("quiz", quizCheckpoint(stage.id, attempt)), () => preparePersonalizedQuiz({ state, stages, index, learnerId, ...ai }), (r) => r.fallbackReason);
        const answers = scriptedAnswers(quiz.questions, script.focus, wrong);
        const grade = gradeQuiz(quiz, answers);
        state = withQuizResult(state, stage.id, quiz, answers, grade);
        return { quiz, answers, grade };
      };
      const failed = await takeQuiz(first, 2);
      await run(at("feedback", feedbackCheckpoint(first.id, failed.quiz.attempt)), () =>
        prepareFeedback({
          learnerId,
          ctx: { stage: first, quiz: failed.quiz, answers: failed.answers, profile: state.profile!, language, projectParts: state.parts.map((p) => p.key) },
          ...ai,
        }), (r) => r.fallbackReason);
      await takeQuiz(first, 1);
      await insight(`stage:${first.id}`);
      const next = stages.find((s) => !state.progress[s.id]?.passed);
      if (next) {
        await run(at("lesson", lessonCheckpoint(next.id, state.level!)), () => prepareLesson({ learnerId, ctx: lessonContext(state, next), ...ai }), (r) => r.fallbackReason);
        const index = stages.findIndex((s) => s.id === next.id);
        await run(at("quiz", quizCheckpoint(next.id, 0)), () => preparePersonalizedQuiz({ state, stages, index, learnerId, ...ai }), (r) => r.fallbackReason);
      }
      const circuit = demoCircuit();
      const issues = validate(circuit).issues;
      await run(at("wiring", wiringCheckpoint({ issues })), () =>
        explainWiring({ learnerId, ctx: { issues, circuit, language, projectTitle: state.project!.title.en, projectParts: state.parts.map((p) => p.key) }, ...ai }), (r) => r.fallbackReason);
      await run(at("component", componentCheckpoint(DEMO_COMPONENT)), () =>
        lookupComponent({ learnerId, ctx: { name: DEMO_COMPONENT, language, projectTitle: state.project!.title.en, projectParts: state.parts.map((p) => p.key) }, ...ai }),
        (r) => (r.kind === "none" ? r.fallbackReason : undefined));
      const suggestionProject = exampleProjects.find((example) => example.id === "countdown-timer")!;
      await run(
        at("suggestions", suggestionsCheckpoint(suggestionProject.description)),
        () => suggestParts(suggestionProject.description, ai),
        (r) => r.fallbackReason,
      );
    }
  } catch (error) {
    if (error instanceof DemoStop) return { requests, stopped: error.reason };
    throw error;
  }
  return { requests, stopped: null };
}

class DemoStop extends Error {
  constructor(readonly reason: FallbackReason) {
    super(`Demo preparation stopped: ${reason}`);
  }
}

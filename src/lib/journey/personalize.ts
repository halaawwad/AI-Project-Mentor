import { AiSuggestionError, createAiClient, type AiClient } from "@/lib/suggest/aiEngine";
import { readAiConfig, type AiConfig } from "@/lib/suggest/config";
import { buildLocalQuiz, emptyHistory, initialProfile, planNextQuiz } from "./adaptive";
import { getAiCache, putAiCache } from "@/lib/ai/cache";
import { requestAiQuiz, validateGeneratedQuiz, type AiQuizContext, type GeneratedQuiz } from "./aiQuiz";
import {
  buildLocalInsight,
  cachedInsight,
  latestInsight,
  mentorCheckpoint,
  previousPlanFor,
  type MentorContext,
} from "./mentor";
import { requestMentorInsight, validateMentorInsight } from "./mentorAi";
import type { JourneyState, MentorInsight, PersonalizedQuiz, Stage } from "./types";

/** Demo-cache checkpoint of a stage quiz: stage id and attempt number (0 = first attempt). */
export const quizCheckpoint = (stageId: string, attempt: number) => `${stageId}#${attempt}`;

/** A validated quiz in Gemini's response format, so a cached copy is validated the same way again. */
export const rawQuiz = (quiz: GeneratedQuiz) => ({
  explanation: quiz.explanation,
  practiceTask: quiz.practiceTask,
  questions: quiz.questions.map((q) => ({
    prompt: q.prompt,
    options: q.options,
    correctIndex: q.correct,
    explanation: q.explanation,
    skill: q.skill,
    difficulty: q.difficulty,
  })),
});

/** The cached quiz for the stage's next attempt, if it is still valid. */
export function cachedQuiz(state: JourneyState, stageId: string): PersonalizedQuiz | null {
  const history = state.profile?.history[stageId] ?? emptyHistory();
  const pending = history.pending;
  return pending && pending.attempt === history.attempts.length && pending.language === state.language
    ? pending
    : null;
}

/**
 * Prepares the next quiz for `stages[index]`:
 * 1. a cached quiz for this attempt is returned as is (no request);
 * 2. otherwise the adaptive rules make a plan, and Gemini writes the quiz in one request;
 * 3. with no key, or on any error or invalid answer, the local bank is used with the same plan.
 * It never throws. The caller saves the result as the stage's pending quiz.
 */
export async function preparePersonalizedQuiz({
  state,
  stages,
  index,
  learnerId,
  config,
  client,
}: {
  state: JourneyState;
  stages: Stage[];
  index: number;
  learnerId: string;
  config?: AiConfig;
  client?: AiClient;
}): Promise<PersonalizedQuiz> {
  const stage = stages[index]!;
  const cached = cachedQuiz(state, stage.id);
  if (cached) return cached;
  const profile = state.profile ?? initialProfile(state.level ?? "intermediate");
  const plan = planNextQuiz(stages, index, profile, state.progress);
  const local = buildLocalQuiz(stages, index, plan, profile, learnerId, state.language);
  // The latest mentor analysis steers the quiz towards the identified misconceptions.
  const insight = latestInsight(state);
  const ctx: AiQuizContext = {
    stage,
    plan,
    profile,
    language: state.language,
    projectParts: state.parts.map((p) => p.key),
    ...(insight ? { mentor: { source: insight.source, diagnosis: insight.diagnosis } } : {}),
  };
  const asAi = (generated: GeneratedQuiz): PersonalizedQuiz => ({
    ...local,
    id: `${stage.id}-ai-${learnerId}-${local.attempt + 1}`,
    source: "ai",
    explanation: generated.explanation,
    practiceTask: generated.practiceTask,
    questions: generated.questions,
  });
  // Demo cache: a validated earlier Gemini quiz for this learner, stage, attempt and language.
  const checkpoint = quizCheckpoint(stage.id, local.attempt);
  const stored = getAiCache(learnerId, "quiz", checkpoint, state.language);
  const reused = stored ? validateGeneratedQuiz(stored.value, ctx) : null;
  if (reused) return asAi(reused);
  const settings = config ?? readAiConfig();
  if (!settings.apiKey) return { ...local, fallbackReason: "missing-key" };
  try {
    const generated = await requestAiQuiz(ctx, {
      client: client ?? createAiClient(settings.apiKey),
      model: settings.model,
      timeoutMs: settings.timeoutMs,
      apiKey: settings.apiKey,
    });
    putAiCache({ feature: "quiz", learner: learnerId, checkpoint, language: state.language, value: rawQuiz(generated) });
    return asAi(generated);
  } catch (error) {
    return { ...local, fallbackReason: error instanceof AiSuggestionError ? error.reason : "bad-response" };
  }
}

/** Everything the diagnosis and plan for the current checkpoint are built from. */
export function mentorContext(state: JourneyState, stages: Stage[], checkpoint: string): MentorContext {
  const level = state.level ?? "intermediate";
  return {
    stages,
    progress: state.progress,
    profile: state.profile ?? initialProfile(level),
    level,
    language: state.language,
    projectTitle: state.project?.title.en ?? "",
    projectParts: state.parts.map((p) => p.key),
    previous: previousPlanFor(state.mentor, checkpoint, state.language),
    lockedOrder: state.mentor?.checkpoint === checkpoint ? state.mentor.order : null,
  };
}

/**
 * Mentor analysis and personalized plan for the current checkpoint (after the level check or a
 * completed stage):
 * 1. a cached insight for this checkpoint and language is returned as is (no request);
 * 2. otherwise Gemini returns diagnosis and plan together in one request (no retries);
 * 3. with no key, or on any error or invalid answer, the local rules are used.
 * `force` skips the cache (the learner's explicit "Try Gemini again"). It never throws.
 */
export async function prepareMentorInsight({
  state,
  stages,
  learnerId,
  config,
  client,
  force = false,
}: {
  state: JourneyState;
  stages: Stage[];
  learnerId: string;
  config?: AiConfig;
  client?: AiClient;
  force?: boolean;
}): Promise<MentorInsight | null> {
  const checkpoint = mentorCheckpoint(state, stages);
  if (!checkpoint) return null;
  const cached = cachedInsight(state, checkpoint);
  if (cached && !force) return cached;
  const ctx = mentorContext(state, stages, checkpoint);
  const local = buildLocalInsight(ctx, checkpoint, learnerId);
  const asAi = (result: { diagnosis: MentorInsight["diagnosis"]; plan: MentorInsight["plan"] }): MentorInsight => ({
    ...local,
    id: `${checkpoint}-ai-${learnerId}-${state.language}`,
    source: "ai",
    ...result,
  });
  // Demo cache: reused only if it matches the learner's real answers as it is. If validation
  // would have to repair it (e.g. a weak skill the learner now answered right), it was made for
  // other answers, so one fresh request is made instead.
  const stored = force ? null : getAiCache(learnerId, "mentor", checkpoint, state.language);
  const reused = stored ? validateMentorInsight(stored.value, ctx) : null;
  if (reused?.ok && !reused.repaired.length) return asAi(reused);
  const settings = config ?? readAiConfig();
  if (!settings.apiKey) return { ...local, fallbackReason: "missing-key" };
  try {
    const result = await requestMentorInsight(ctx, {
      client: client ?? createAiClient(settings.apiKey),
      model: settings.model,
      timeoutMs: settings.timeoutMs,
      apiKey: settings.apiKey,
    });
    putAiCache({ feature: "mentor", learner: learnerId, checkpoint, language: state.language, value: result });
    return asAi(result);
  } catch (error) {
    return { ...local, fallbackReason: error instanceof AiSuggestionError ? error.reason : "bad-response" };
  }
}

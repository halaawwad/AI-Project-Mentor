import { AiSuggestionError, createAiClient, type AiClient } from "@/lib/suggest/aiEngine";
import { readAiConfig, type AiConfig } from "@/lib/suggest/config";
import { buildLocalQuiz, emptyHistory, initialProfile, planNextQuiz } from "./adaptive";
import { requestAiQuiz } from "./aiQuiz";
import {
  buildLocalInsight,
  cachedInsight,
  latestInsight,
  mentorCheckpoint,
  previousPlanFor,
  type MentorContext,
} from "./mentor";
import { requestMentorInsight } from "./mentorAi";
import type { JourneyState, MentorInsight, PersonalizedQuiz, Stage } from "./types";

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
  const settings = config ?? readAiConfig();
  if (!settings.apiKey) return { ...local, fallbackReason: "missing-key" };
  // The latest mentor analysis steers the quiz towards the identified misconceptions.
  const insight = latestInsight(state);
  try {
    const generated = await requestAiQuiz(
      {
        stage,
        plan,
        profile,
        language: state.language,
        projectParts: state.parts.map((p) => p.key),
        ...(insight ? { mentor: { source: insight.source, diagnosis: insight.diagnosis } } : {}),
      },
      { client: client ?? createAiClient(settings.apiKey), model: settings.model, timeoutMs: settings.timeoutMs },
    );
    return {
      ...local,
      id: `${stage.id}-ai-${learnerId}-${local.attempt + 1}`,
      source: "ai",
      explanation: generated.explanation,
      practiceTask: generated.practiceTask,
      questions: generated.questions,
    };
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
  const settings = config ?? readAiConfig();
  if (!settings.apiKey) return { ...local, fallbackReason: "missing-key" };
  try {
    const result = await requestMentorInsight(ctx, {
      client: client ?? createAiClient(settings.apiKey),
      model: settings.model,
      timeoutMs: settings.timeoutMs,
    });
    return { ...local, id: `${checkpoint}-ai-${learnerId}-${state.language}`, source: "ai", ...result };
  } catch (error) {
    return { ...local, fallbackReason: error instanceof AiSuggestionError ? error.reason : "bad-response" };
  }
}

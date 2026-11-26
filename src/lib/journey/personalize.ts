import { AiSuggestionError, createAiClient, type AiClient } from "@/lib/suggest/aiEngine";
import { readAiConfig, type AiConfig } from "@/lib/suggest/config";
import { buildLocalQuiz, emptyHistory, initialProfile, planNextQuiz } from "./adaptive";
import { requestAiQuiz } from "./aiQuiz";
import type { JourneyState, PersonalizedQuiz, Stage } from "./types";

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
  try {
    const generated = await requestAiQuiz(
      { stage, plan, profile, language: state.language, projectParts: state.parts.map((p) => p.key) },
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

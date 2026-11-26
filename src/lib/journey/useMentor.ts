import { useEffect } from "react";
import { cachedInsight, latestInsight, mentorCheckpoint } from "./mentor";
import { prepareMentorInsight } from "./personalize";
import { activeLearner, readJourney, saveMentorInsight, useActiveLearner, useJourney } from "./store";
import type { Stage } from "./types";

/** One request at a time per learner, checkpoint and language, shared by every screen. */
const inFlight = new Map<string, Promise<void>>();

/**
 * Makes sure the current checkpoint has a diagnosis and plan in the current language. A cached
 * one means no request. `force` is the learner's explicit "Try Gemini again" (one request).
 */
export function ensureMentorInsight(stages: Stage[], force = false): Promise<void> {
  const state = readJourney();
  const learner = activeLearner();
  const checkpoint = mentorCheckpoint(state, stages);
  if (!checkpoint || (!force && cachedInsight(state, checkpoint))) return Promise.resolve();
  const key = `${learner}|${checkpoint}|${state.language}`;
  const running = inFlight.get(key);
  if (running) return running;
  const run = prepareMentorInsight({ state, stages, learnerId: learner, force })
    .then((insight) => {
      const now = readJourney();
      // Drop the result if the learner, checkpoint or language changed in the meantime.
      if (!insight || activeLearner() !== learner || now.language !== insight.language) return;
      if (mentorCheckpoint(now, stages) !== insight.checkpoint) return;
      saveMentorInsight(insight);
    })
    .finally(() => inFlight.delete(key));
  inFlight.set(key, run);
  return run;
}

/**
 * The mentor analysis and plan for the screens that show them. While a new checkpoint's insight
 * is being prepared, the latest earlier one is returned as `shown` with `stale: true`.
 */
export function useMentorInsight(stages: Stage[]) {
  const journey = useJourney();
  const learner = useActiveLearner();
  const checkpoint = mentorCheckpoint(journey, stages);
  const insight = checkpoint ? cachedInsight(journey, checkpoint) : null;
  const missing = Boolean(checkpoint && !insight);
  useEffect(() => {
    if (missing) void ensureMentorInsight(stages);
    // `stages` is rebuilt on every render; the checkpoint and language identify the request.
  }, [missing, checkpoint, learner, journey.language]);
  const shown = insight ?? latestInsight(journey);
  return {
    checkpoint,
    insight,
    shown,
    stale: Boolean(shown && shown !== insight),
    preparing: missing,
    previous: journey.mentor?.previous ?? null,
    retry: () => ensureMentorInsight(stages, true),
  };
}

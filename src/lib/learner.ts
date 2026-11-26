/**
 * AiPM has one learner per browser, like a real student. The id is only used inside AI cache keys
 * and generated quiz ids.
 *
 * Data saved by the earlier two-learner demo is migrated once: Student A ("a") becomes the
 * learner (its journey was already stored under the main journey key), and Student B ("b") is
 * discarded.
 */
export const LEARNER_ID = "learner";

export const LEGACY_LEARNER_A = "a";
export const LEGACY_LEARNER_B = "b";
/** Storage keys of the removed Student B journey and the removed learner switch. */
export const LEGACY_KEYS = {
  learnerBJourney: "aipm.journey.v1.learner-b",
  activeLearner: "aipm.learner.active",
} as const;

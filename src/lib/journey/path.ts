import { buildGenericPath } from "./generic";
import { basics, learningProjectById } from "./projects";
import type { JourneyState, Stage } from "./types";

/**
 * The learning path for the current journey: beginners get the basics stage first, then the
 * written stages of a known project, or stages generated from the approved parts.
 */
export function buildPath(state: Pick<JourneyState, "project" | "parts" | "level">): Stage[] {
  if (!state.project || !state.level) return [];
  const written = state.project.id === "custom" ? null : learningProjectById(state.project.id);
  const stages = written ? written.stages : buildGenericPath(state.parts);
  if (!stages.length) return [];
  return state.level === "beginner" ? [basics, ...stages] : stages;
}

/** Journey indicator steps, in order. */
export const journeySteps = [
  { id: "idea", en: "Idea", ar: "الفكرة" },
  { id: "parts", en: "Parts", ar: "القطع" },
  { id: "level", en: "Level", ar: "المستوى" },
  { id: "path", en: "Learning path", ar: "مسار التعلّم" },
  { id: "quizzes", en: "Quizzes", ar: "الاختبارات" },
  { id: "ready", en: "Ready", ar: "جاهز" },
] as const;
export type JourneyStepId = (typeof journeySteps)[number]["id"];

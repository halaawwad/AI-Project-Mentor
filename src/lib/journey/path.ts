import { buildGenericPath } from "./generic";
import { basics, learningProjectById } from "./projects";
import type { JourneyState, MentorState, Stage, StageProgress } from "./types";

/**
 * Declared prerequisites of the written stages (stages present in the path only). Stages that
 * don't depend on each other may be reordered by the personalized plan:
 * - traffic light: LEDs → timing → button (each builds on the one before);
 * - parking sensor: distance and buzzer are independent; the warning needs both;
 * - irrigation: sensor and relay are independent; the logic needs both.
 * The basics stage, when present, comes before everything.
 */
const WRITTEN_PREREQUISITES: Record<string, string[]> = {
  basics: [],
  "traffic-leds": [],
  "traffic-timing": ["traffic-leds"],
  "traffic-button": ["traffic-timing"],
  "parking-distance": [],
  "parking-buzzer": [],
  "parking-warning": ["parking-distance", "parking-buzzer"],
  "irrigation-sensor": [],
  "irrigation-relay": [],
  "irrigation-logic": ["irrigation-sensor", "irrigation-relay"],
};

/** Prerequisites per stage. Generated paths: the controller first, "wiring it all together" last. */
export function stagePrerequisites(stages: Stage[]): Record<string, string[]> {
  const ids = new Set(stages.map((s) => s.id));
  return Object.fromEntries(
    stages.map((stage, i) => {
      const declared = WRITTEN_PREREQUISITES[stage.id];
      let requires: string[];
      if (declared) requires = declared;
      else if (stage.id === "generic-controller") requires = [];
      else if (stage.id === "generic-together") requires = stages.filter((s) => s.id !== stage.id).map((s) => s.id);
      else if (stage.id.startsWith("generic-")) requires = ["generic-controller"];
      else requires = i > 0 ? [stages[i - 1]!.id] : [];
      if (ids.has("basics") && stage.id !== "basics") requires = ["basics", ...requires];
      return [stage.id, [...new Set(requires.filter((id) => ids.has(id) && id !== stage.id))]];
    }),
  );
}

/**
 * True if `order` (stage ids) is a safe order for these stages: every stage exactly once, each
 * after its prerequisites, and completed or attempted stages first.
 */
export function isSafeOrder(stages: Stage[], order: string[], progress: Record<string, StageProgress>) {
  if (order.length !== stages.length || new Set(order).size !== order.length) return false;
  if (!order.every((id) => stages.some((s) => s.id === id))) return false;
  const prerequisites = stagePrerequisites(stages);
  const seen = new Set<string>();
  for (const id of order) {
    if (prerequisites[id]!.some((p) => !seen.has(p))) return false;
    seen.add(id);
  }
  // Completed or attempted stages must form the start of the order, so locking never changes for them.
  const fixed = new Set(stages.filter((s) => progress[s.id]).map((s) => s.id));
  return order.slice(0, fixed.size).every((id) => fixed.has(id));
}

/**
 * The learning path for the current journey: beginners get the basics stage first, then the
 * written stages of a known project, or stages generated from the approved parts. A validated
 * personalized order (from the mentor plan) is applied when it is still safe; locking then
 * follows that order with the same rule (pass the stage before to unlock the next).
 */
export function buildPath(
  state: Pick<JourneyState, "project" | "parts" | "level"> & {
    mentor?: MentorState | null;
    progress?: Record<string, StageProgress>;
  },
): Stage[] {
  if (!state.project || !state.level) return [];
  const written = state.project.id === "custom" ? null : learningProjectById(state.project.id);
  const stages = written ? written.stages : buildGenericPath(state.parts);
  if (!stages.length) return [];
  const base = state.level === "beginner" ? [basics, ...stages] : stages;
  const order = state.mentor?.order;
  if (!order || !isSafeOrder(base, order, state.progress ?? {})) return base;
  return order.map((id) => base.find((s) => s.id === id)!);
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

export type SuggestionLanguage = "ar" | "en";

/** One part the student's project needs, chosen from the local catalog by exact key. */
export interface PartSuggestion {
  key: string;
  quantity: number;
  /** What the part does in this project. */
  role: string;
  /** Why the project needs it. */
  reason: string;
}

/** `ai`: validated Gemini output. `demo`: the local example/keyword engine. */
export type SuggestionSource = "ai" | "demo";

/** Why demo suggestions are shown instead of AI suggestions. */
export type FallbackReason =
  | "missing-key"
  | "invalid-key"
  | "permission"
  | "rate-limit"
  | "timeout"
  | "network"
  | "unavailable"
  | "bad-request"
  | "blocked"
  | "empty"
  | "bad-response";

export interface SuggestionResult {
  source: SuggestionSource;
  language: SuggestionLanguage;
  summary: string;
  parts: PartSuggestion[];
  /** Set when `source` is `demo` because the AI could not be used. */
  fallbackReason?: FallbackReason;
  /** AI items removed during validation (unknown keys, invalid quantities, malformed items). */
  droppedCount?: number;
}

/** Largest quantity a suggestion may carry; anything above is treated as invalid. */
export const MAX_SUGGESTED_QUANTITY = 50;

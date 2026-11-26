import { componentCatalog } from "@/lib/componentCatalog";
import {
  AiSuggestionError,
  createAiClient,
  generateStructured,
  type AiClient,
  type Checked,
  type StructuredCall,
} from "@/lib/suggest/aiEngine";
import { readAiConfig, type AiConfig } from "@/lib/suggest/config";
import type { FallbackReason } from "@/lib/suggest/types";

/** Shared helpers for the structured Gemini features (one request per action, no retries). */
export type Language = "ar" | "en";

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** Collapses whitespace and trims; non-strings become "". */
export const cleanText = (value: unknown, max = 400) =>
  typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, max) : "";

/** Text that is too long is rejected rather than cut, so lessons are never truncated mid-sentence. */
export const withinLength = (value: unknown, min: number, max: number) =>
  typeof value === "string" && value.trim().length >= min && value.trim().length <= max;

const ARABIC = /[؀-ۿ]/;
/** Arabic output must contain Arabic letters; English output must not. */
export const matchesLanguage = (text: string, language: Language) =>
  language === "ar" ? ARABIC.test(text) : !ARABIC.test(text);

/** Catalog keys a text may name: the given parts plus every controller. */
export function allowedPartKeys(keys: Iterable<string>) {
  const allowed = new Set(keys);
  for (const item of componentCatalog) if (item.def.category === "Microcontrollers") allowed.add(item.key);
  return allowed;
}

/** True if the texts name a catalog part outside `allowed` (by its English catalog name). */
export function mentionsForeignPart(texts: string[], allowed: Set<string>) {
  const text = texts.join(" ").toLowerCase();
  return componentCatalog.some((item) => !allowed.has(item.key) && text.includes(item.name.toLowerCase()));
}

export const hasUrl = (text: string) => /https?:\/\/|www\.|\.pdf\b/i.test(text);

export const fallbackReasonOf = (error: unknown): FallbackReason =>
  error instanceof AiSuggestionError ? error.reason : "bad-response";

export type AiCall = StructuredCall;

/** The Gemini client and settings, or null when no key is configured (no request is made). */
export function resolveAi(config?: AiConfig, client?: AiClient): AiCall | null {
  const settings = config ?? readAiConfig();
  if (!settings.apiKey) return null;
  return {
    client: client ?? createAiClient(settings.apiKey),
    model: settings.model,
    timeoutMs: settings.timeoutMs,
    apiKey: settings.apiKey,
  };
}

/**
 * One structured-JSON request (minimal thinking, timeout, no retries) whose answer must pass
 * `validate`. Throws AiSuggestionError with the fallback reason.
 */
export const generateJson = <T>(
  call: AiCall,
  request: {
    feature: string;
    system: string;
    contents: string;
    schema: object;
    validate: (raw: unknown) => T | null | Checked<T>;
  },
) => generateStructured(call, request);

/** The language rule shared by every prompt. */
export const languageRule = (language: Language) =>
  language === "ar"
    ? "Write all text in simple Arabic, but keep technical terms, pin names, part names and code in English (GND, VCC, PWM, Arduino, LED, I²C, digitalWrite)."
    : "Write all text in English.";

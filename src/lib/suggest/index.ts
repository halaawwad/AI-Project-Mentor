import { AiSuggestionError, createAiClient, requestAiSuggestions, type AiClient } from "./aiEngine";
import { readAiConfig, type AiConfig } from "./config";
import { getAiCache, putAiCache } from "@/lib/ai/cache";
import { LEARNER_ID } from "@/lib/learner";
import { detectLanguage } from "./language";
import { validateAiSuggestions } from "./validate";
import { suggestPartsDemo } from "./demoEngine";
import type { FallbackReason, SuggestionResult } from "./types";

export type { MissingPartSuggestion, PartSuggestion, SuggestionResult, FallbackReason } from "./types";

/** Hash descriptions for a local cache key without persisting the project text in the key. */
export function suggestionsCheckpoint(description: string) {
  const text = description.normalize("NFKC").replace(/\s+/g, " ").trim().toLowerCase();
  let hash = 2166136261;
  for (let index = 0; index < text.length; index++)
    hash = Math.imul(hash ^ text.charCodeAt(index), 16777619);
  return `suggestions:${(hash >>> 0).toString(36)}`;
}

/**
 * Single entry point for part suggestions. With a Gemini API key it returns validated AI
 * suggestions; without a key, or when the call fails, it returns the local demo engine's
 * result with the reason. It never throws.
 */
export async function suggestParts(
  description: string,
  options: { config?: AiConfig; client?: AiClient } = {},
): Promise<SuggestionResult> {
  const config = options.config ?? readAiConfig();
  const checkpoint = suggestionsCheckpoint(description);
  const language = detectLanguage(description);
  const cached = getAiCache(LEARNER_ID, "suggestions", checkpoint, language);
  if (cached) {
    const result = validateAiSuggestions(cached.value, description);
    if (result)
      return {
        source: "ai",
        language: result.language,
        summary: result.summary,
        parts: result.parts,
        missingParts: result.missingParts,
        droppedCount: result.dropped,
      };
  }
  const demo = (fallbackReason: FallbackReason): SuggestionResult => ({
    source: "demo",
    ...suggestPartsDemo(description),
    fallbackReason,
  });
  if (!config.apiKey) return demo("missing-key");
  try {
    const result = await requestAiSuggestions(description, {
      client: options.client ?? createAiClient(config.apiKey),
      model: config.model,
      timeoutMs: config.timeoutMs,
      apiKey: config.apiKey,
    });
    putAiCache({
      feature: "suggestions",
      learner: LEARNER_ID,
      checkpoint,
      language,
      value: result.cacheValue,
    });
    return {
      source: "ai",
      language: result.language,
      summary: result.summary,
      parts: result.parts,
      missingParts: result.missingParts,
      droppedCount: result.dropped,
    };
  } catch (error) {
    return demo(error instanceof AiSuggestionError ? error.reason : "bad-response");
  }
}

export const aiConfigured = () => readAiConfig().apiKey.length > 0;

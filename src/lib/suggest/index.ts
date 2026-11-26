import { AiSuggestionError, createAiClient, requestAiSuggestions, type AiClient } from "./aiEngine";
import { readAiConfig, type AiConfig } from "./config";
import { suggestPartsDemo } from "./demoEngine";
import type { FallbackReason, SuggestionResult } from "./types";

export type { PartSuggestion, SuggestionResult, FallbackReason } from "./types";

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
    });
    return {
      source: "ai",
      language: result.language,
      summary: result.summary,
      parts: result.parts,
      droppedCount: result.dropped,
    };
  } catch (error) {
    return demo(error instanceof AiSuggestionError ? error.reason : "bad-response");
  }
}

export const aiConfigured = () => readAiConfig().apiKey.length > 0;

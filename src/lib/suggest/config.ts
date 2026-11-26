export const DEFAULT_MODEL = "gemini-3.5-flash";
/** Upper bound for the single suggestion request (no automatic retries). */
export const DEFAULT_TIMEOUT_MS = 30_000;

export interface AiConfig {
  apiKey: string;
  model: string;
  timeoutMs: number;
}

type SuggestEnv = Pick<ImportMetaEnv, "VITE_GEMINI_API_KEY" | "VITE_GEMINI_MODEL">;

/**
 * Reads the in-browser Gemini settings. The key is only ever passed to the SDK client;
 * it is never logged or rendered.
 */
export function readAiConfig(env: SuggestEnv = import.meta.env): AiConfig {
  return {
    apiKey: (env.VITE_GEMINI_API_KEY ?? "").trim(),
    model: (env.VITE_GEMINI_MODEL ?? "").trim() || DEFAULT_MODEL,
    timeoutMs: DEFAULT_TIMEOUT_MS,
  };
}

export const DEFAULT_MODEL = "gemini-3.5-flash";
/** Upper bound for one Gemini request (no automatic retries). The UI says "still working" after 15 s. */
export const DEFAULT_TIMEOUT_MS = 90_000;
export const STILL_WORKING_MS = 15_000;

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

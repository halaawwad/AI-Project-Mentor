/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Gemini API key for in-browser suggestions. Set it in `.env.local`; never commit it. */
  readonly VITE_GEMINI_API_KEY?: string;
  /** Gemini model id; defaults to `gemini-3.5-flash`. */
  readonly VITE_GEMINI_MODEL?: string;
}

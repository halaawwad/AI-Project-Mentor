import { useSyncExternalStore } from "react";
import type { FallbackReason } from "./types";

/**
 * Outcome of every Gemini call (feature, model, duration, HTTP status, reason), for the Demo
 * readiness screen and the dev console. The API key is never recorded: details are redacted.
 */
export interface AiCallLog {
  feature: string;
  model: string;
  durationMs: number;
  outcome: "ok" | FallbackReason;
  status?: number;
  /** Short, redacted error detail (no key, no request body). */
  detail?: string;
  at: number;
}

const MAX_LOGS = 40;
let logs: AiCallLog[] = [];
const listeners = new Set<() => void>();

/** Removes anything that looks like a Google API key, plus the configured key itself. */
export function redact(text: string, key = "") {
  let out = text.replace(/AIza[0-9A-Za-z_-]{20,}/g, "[redacted]");
  if (key.trim().length >= 8) out = out.split(key.trim()).join("[redacted]");
  return out.replace(/\s+/g, " ").trim().slice(0, 600);
}

const isDevConsole = () => import.meta.env.DEV && import.meta.env.MODE !== "test";

export function recordAiCall(entry: Omit<AiCallLog, "at">) {
  const full: AiCallLog = { ...entry, at: Date.now() };
  logs = [full, ...logs].slice(0, MAX_LOGS);
  listeners.forEach((listener) => listener());
  if (isDevConsole()) {
    const line = `[AiPM Gemini] ${entry.feature} · ${entry.model} · ${(entry.durationMs / 1000).toFixed(1)} s · ${entry.outcome}${entry.status ? ` (HTTP ${entry.status})` : ""}`;
    if (entry.outcome === "ok") console.info(line, entry.detail ?? "");
    else console.warn(line, entry.detail ?? "");
  }
}

export const aiCallLogs = () => logs;
export const clearAiCallLogs = () => {
  logs = [];
  listeners.forEach((listener) => listener());
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
export const useAiCallLogs = () => useSyncExternalStore(subscribe, aiCallLogs, aiCallLogs);

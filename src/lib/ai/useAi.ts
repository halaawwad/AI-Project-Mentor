import { useEffect, useState } from "react";
import { useAiCacheVersion } from "./cache";

/** Results of this session (AI or fallback), so re-renders and remounts never request again. */
const session = new Map<string, unknown>();
const inFlight = new Map<string, Promise<unknown>>();

/** Runs `run` once per key (shared by concurrent callers). `force` is an explicit "Try again". */
export function runAiOnce<T>(key: string, run: () => Promise<T>, force = false): Promise<T> {
  if (!force && session.has(key)) return Promise.resolve(session.get(key) as T);
  const running = inFlight.get(key);
  if (running) return running as Promise<T>;
  const promise = run()
    .then((value) => {
      session.set(key, value);
      return value;
    })
    .finally(() => inFlight.delete(key));
  inFlight.set(key, promise);
  return promise;
}

/**
 * One automatic AI action per key: `peek` returns a cached AI result synchronously (no request);
 * otherwise `run` is started once. A null key does nothing.
 */
export function useAiResult<T>(key: string | null, run: () => Promise<T>, peek?: () => T | null) {
  useAiCacheVersion();
  const [state, setState] = useState<{ key: string | null; value: T | null }>({ key: null, value: null });
  const peeked = key ? (peek?.() ?? null) : null;
  useEffect(() => {
    if (!key || peeked) return;
    let live = true;
    void runAiOnce(key, run).then((value) => {
      if (live) setState({ key, value });
    });
    return () => {
      live = false;
    };
    // `run` and `peek` are rebuilt every render; the key identifies the request.
  }, [key, peeked === null]);
  const value = peeked ?? (state.key === key ? state.value : key ? ((session.get(key) as T | undefined) ?? null) : null);
  return {
    value,
    busy: Boolean(key) && value === null,
    retry: () => {
      if (!key) return Promise.resolve();
      return runAiOnce(key, run, true).then((v) => setState({ key, value: v }));
    },
  };
}

/**
 * Local demo persistence, adapted from LabAssist `shared/web/localStorage.ts`.
 * Every AiPM key is namespaced with `aipm.`. A key that holds unreadable data is never
 * overwritten silently: writes to it are refused until the person resets it explicitly.
 */
export const STORAGE_KEYS = {
  bom: "aipm.bom.v1",
  labProject: "aipm.lab.project.v1",
  journey: "aipm.journey.v1",
  activeLearner: "aipm.learner.active",
} as const;

export const storageEvent = "aipm-storage-result";
const unreadable = new Set<string>();
let failure = "";

function storage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function storageFailure(message: string) {
  failure = message;
  if (typeof window !== "undefined" && typeof window.dispatchEvent === "function")
    window.dispatchEvent(new Event(storageEvent));
}
export const currentStorageFailure = () => failure;
export const unreadableKeys = () => [...unreadable];

/**
 * Reads and validates a saved value. Missing data returns `fallback`. Data that cannot be
 * parsed or fails `isValid` also returns `fallback`, marks the key unreadable and reports it.
 */
export function readLocal<T>(key: string, fallback: T, isValid: (value: unknown) => boolean): T {
  try {
    const store = storage();
    if (!store) throw new Error("Local storage is unavailable");
    const raw = store.getItem(key);
    if (raw === null) {
      unreadable.delete(key);
      return fallback;
    }
    const value: unknown = JSON.parse(raw);
    if (!isValid(value)) throw new Error("Unrecognized saved data");
    unreadable.delete(key);
    return value as T;
  } catch {
    unreadable.add(key);
    storageFailure(
      "Saved AiPM data could not be loaded. It was left untouched; allow storage and reload, or reset the unreadable data.",
    );
    return fallback;
  }
}

/** Throws when the value could not be saved; callers only report success after it returns. */
export function writeLocal(key: string, value: unknown) {
  try {
    if (unreadable.has(key))
      throw new Error("Saved data could not be read; reload or reset it before saving.");
    const store = storage();
    if (!store) throw new Error("Local storage is unavailable");
    store.setItem(key, JSON.stringify(value));
    if (!unreadable.size) storageFailure("");
  } catch (cause) {
    storageFailure(
      "Could not save on this device. Your changes stay on screen; allow storage and try again.",
    );
    throw cause;
  }
}

/** Explicit, user-initiated removal of one key (also clears its unreadable flag). */
export function removeLocal(key: string) {
  unreadable.delete(key);
  try {
    storage()?.removeItem(key);
  } catch {
    /* nothing more can be done; the key stays as it was */
  }
  if (!unreadable.size) storageFailure("");
}

/** Explicit, user-initiated reset of keys that hold unreadable data. */
export function resetUnreadable() {
  const store = storage();
  for (const key of unreadable) {
    try {
      store?.removeItem(key);
    } catch {
      /* the reload below reports any remaining failure */
    }
  }
  unreadable.clear();
  storageFailure("");
}

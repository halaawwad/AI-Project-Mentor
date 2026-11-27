import {
  componentCatalog,
  findCatalogItemByName,
} from "@/lib/componentCatalog";
import { detectLanguage } from "./language";
import {
  MAX_SUGGESTED_QUANTITY,
  type MissingPartSuggestion,
  type PartSuggestion,
  type SuggestionLanguage,
} from "./types";

const MAX_TEXT = 300;
const MAX_SUMMARY = 800;

const clean = (value: unknown, max: number) =>
  typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, max) : "";

export const isValidQuantity = (value: unknown): value is number =>
  typeof value === "number" &&
  Number.isInteger(value) &&
  value >= 1 &&
  value <= MAX_SUGGESTED_QUANTITY;

/**
 * Merges entries with the same catalog key: quantities are added (capped), and distinct
 * roles and reasons are kept. Order follows each key's first appearance.
 */
export function mergeSuggestions(items: PartSuggestion[]): PartSuggestion[] {
  const merged = new Map<string, PartSuggestion>();
  for (const item of items) {
    const existing = merged.get(item.key);
    if (!existing) {
      merged.set(item.key, { ...item });
      continue;
    }
    existing.quantity = Math.min(MAX_SUGGESTED_QUANTITY, existing.quantity + item.quantity);
    if (item.role && !existing.role.includes(item.role))
      existing.role = existing.role ? `${existing.role} · ${item.role}` : item.role;
    if (item.reason && !existing.reason.includes(item.reason))
      existing.reason = existing.reason ? `${existing.reason} ${item.reason}` : item.reason;
  }
  return [...merged.values()];
}

function mergeMissingParts(items: MissingPartSuggestion[]) {
  const merged = new Map<string, MissingPartSuggestion>();
  for (const item of items) {
    const key = item.name.toLowerCase().normalize("NFKC").replace(/[أإآ]/g, "ا").replace(/\s+/g, " ");
    const existing = merged.get(key);
    if (!existing) {
      merged.set(key, { ...item });
      continue;
    }
    existing.quantity = Math.min(MAX_SUGGESTED_QUANTITY, existing.quantity + item.quantity);
    if (!existing.role.includes(item.role)) existing.role = `${existing.role} · ${item.role}`;
    if (!existing.reason.includes(item.reason)) existing.reason = `${existing.reason} ${item.reason}`;
  }
  return [...merged.values()];
}

const containsLink = (text: string) =>
  /https?:\/\/|www\.|\.pdf\b|\b[a-z0-9-]+\.(?:com|net|org|io|edu|gov|co|dev|app)\b/i.test(text);

export interface ValidatedSuggestions {
  language: SuggestionLanguage;
  summary: string;
  parts: PartSuggestion[];
  missingParts: MissingPartSuggestion[];
  /** Revalidation input retaining names that may map to custom parts on a later read. */
  cacheValue: {
    language: SuggestionLanguage;
    summary: string;
    parts: PartSuggestion[];
    missingParts: MissingPartSuggestion[];
  };
  /** Items removed: unknown keys, invalid quantities or malformed entries. */
  dropped: number;
}

/**
 * Strictly validates a parsed AI response. Returns null when the overall shape is unusable
 * (not an object, or no `parts` array). Individual invalid items are dropped and counted;
 * an empty `parts` result is valid and means "no matching parts".
 */
export function validateAiSuggestions(
  raw: unknown,
  description: string,
): ValidatedSuggestions | null {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;
  const record = raw as Record<string, unknown>;
  const list = record["parts"];
  if (!Array.isArray(list)) return null;
  const language =
    record["language"] === "ar" || record["language"] === "en"
      ? record["language"]
      : detectLanguage(description);
  let dropped = 0;
  const valid: PartSuggestion[] = [];
  const direct: PartSuggestion[] = [];
  for (const entry of list) {
    if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
      dropped++;
      continue;
    }
    const item = entry as Record<string, unknown>;
    const key = item["key"];
    const role = clean(item["role"], MAX_TEXT);
    const reason = clean(item["reason"], MAX_TEXT);
    if (
      typeof key !== "string" ||
      !componentCatalog.some((catalogItem) => catalogItem.key === key) ||
      !isValidQuantity(item["quantity"]) ||
      !role ||
      !reason
    ) {
      dropped++;
      continue;
    }
    const suggestion = { key, quantity: item["quantity"], role, reason };
    valid.push(suggestion);
    direct.push(suggestion);
  }
  const missing: MissingPartSuggestion[] = [];
  const cacheMissing: MissingPartSuggestion[] = [];
  const rawMissing = record["missingParts"];
  if (rawMissing !== undefined) {
    if (!Array.isArray(rawMissing)) dropped++;
    else {
      if (rawMissing.length > 5) dropped += rawMissing.length - 5;
      for (const entry of rawMissing.slice(0, 5)) {
        if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
          dropped++;
          continue;
        }
        const item = entry as Record<string, unknown>;
        const name = clean(item["name"], 80);
        const quantity = item["quantity"];
        const role = clean(item["role"], MAX_TEXT);
        const reason = clean(item["reason"], MAX_TEXT);
        if (
          typeof item["name"] !== "string" ||
          item["name"].trim().length > 80 ||
          name.length < 2 ||
          !isValidQuantity(quantity) ||
          !role ||
          !reason ||
          [name, role, reason].some(containsLink)
        ) {
          dropped++;
          continue;
        }
        cacheMissing.push({ name, quantity, role, reason });
        const matched = findCatalogItemByName(name);
        if (matched) {
          valid.push({ key: matched.key, quantity, role, reason });
          continue;
        }
        missing.push({ name, quantity, role, reason });
      }
    }
  }
  const summary = clean(record["summary"], MAX_SUMMARY);
  const cachedParts = mergeSuggestions(direct);
  const cachedMissing = mergeMissingParts(cacheMissing);
  return {
    language,
    summary,
    parts: mergeSuggestions(valid),
    missingParts: mergeMissingParts(missing),
    cacheValue: {
      language,
      summary,
      parts: cachedParts,
      missingParts: cachedMissing,
    },
    dropped,
  };
}

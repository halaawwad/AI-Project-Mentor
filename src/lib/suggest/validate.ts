import { catalogByKey } from "@/lib/componentCatalog";
import { detectLanguage } from "./language";
import { MAX_SUGGESTED_QUANTITY, type PartSuggestion, type SuggestionLanguage } from "./types";

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

export interface ValidatedSuggestions {
  language: SuggestionLanguage;
  summary: string;
  parts: PartSuggestion[];
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
      !catalogByKey.has(key) ||
      !isValidQuantity(item["quantity"]) ||
      !role ||
      !reason
    ) {
      dropped++;
      continue;
    }
    valid.push({ key, quantity: item["quantity"], role, reason });
  }
  return {
    language,
    summary: clean(record["summary"], MAX_SUMMARY),
    parts: mergeSuggestions(valid),
    dropped,
  };
}

import type { SuggestionLanguage } from "./types";

/** Arabic when Arabic letters make up at least a third of the letters, otherwise English. */
export function detectLanguage(text: string): SuggestionLanguage {
  const letters = text.match(/\p{L}/gu) ?? [];
  if (!letters.length) return "en";
  const arabic = letters.filter((c) => /[؀-ۿݐ-ݿ]/.test(c)).length;
  return arabic / letters.length >= 1 / 3 ? "ar" : "en";
}

/** Lower-cases and folds Arabic letter variants so keywords match common spellings. */
export function normalizeText(text: string) {
  return text
    .toLowerCase()
    .normalize("NFKC")
    .replace(/[ً-ْـ]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/\s+/g, " ")
    .trim();
}

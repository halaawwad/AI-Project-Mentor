import type { MissingPartSuggestion } from "./types";

export function missingPartsApprovalReminder(
  missingParts: MissingPartSuggestion[],
  handledNames: string[],
): string | null {
  const handled = new Set(handledNames);
  if (missingParts.every((part) => handled.has(part.name))) return null;
  return "Generate or skip every missing part before approving the list. · " +
    "وللمتابعة، أنشئ كل قطعة مفقودة أو تخطَّها قبل اعتماد القائمة.";
}

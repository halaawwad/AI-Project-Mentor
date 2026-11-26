import { useState } from "react";
import { Loader2, MessageCircleQuestion } from "lucide-react";
import { AiSourceLabel, FallbackReasonNote, StillWorking } from "@/components/AiLabel";
import { runAiOnce } from "@/lib/ai/useAi";
import { useJourney } from "@/lib/journey/store";
import { LEARNER_ID } from "@/lib/learner";
import type { CircuitData } from "@/lib/lab/types";
import type { ValidationResult } from "@/lib/lab/validate";
import { explainWiring, MAX_EXPLAINED, wiringCheckpoint, type WiringContext, type WiringHelp } from "@/lib/lab/wiringAi";

/**
 * "Explain with mentor" after Validate Wiring: sends the rule results (rule, parts, pins) and the
 * learner's project. The explanation and fix of each problem are shown inside that problem's card.
 * The circuit isn't changed; the validation itself stays rule-based.
 */
export function useWiringMentor(result: ValidationResult | null, circuit: CircuitData) {
  const journey = useJourney();
  const language = journey.language;
  const [help, setHelp] = useState<{ key: string; value: WiringHelp } | null>(null);
  const [busy, setBusy] = useState(false);
  const issues = result?.issues ?? [];
  const ctx: WiringContext = {
    issues,
    circuit,
    language,
    projectTitle: journey.project?.title.en ?? "",
    projectParts: journey.parts.map((p) => p.key),
  };
  const learner = LEARNER_ID;
  const key = issues.length ? `wiring|${learner}|${wiringCheckpoint(ctx)}|${language}` : null;
  const shown = key && help?.key === key ? help.value : null;
  const ask = async (force = false) => {
    if (!key || busy) return;
    setBusy(true);
    try {
      setHelp({ key, value: await runAiOnce(key, () => explainWiring({ learnerId: learner, ctx }), force) });
    } finally {
      setBusy(false);
    }
  };
  return {
    available: issues.length > 0,
    busy,
    help: shown,
    issueCount: issues.length,
    dir: language === "ar" ? ("rtl" as const) : ("ltr" as const),
    ask,
  };
}

export type WiringMentor = ReturnType<typeof useWiringMentor>;

/** Compact button in the Wiring Validation header, next to "Re-run". */
export function WiringMentorButton({ mentor }: { mentor: WiringMentor }) {
  if (!mentor.available || mentor.help) return null;
  return (
    <button
      className="inline-flex items-center gap-1 rounded-full bg-primary px-2.5 py-1 text-[11px] font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60"
      disabled={mentor.busy}
      onClick={() => void mentor.ask()}
      title="Explain these problems with the mentor (one Gemini request)"
    >
      {mentor.busy ? <Loader2 className="size-3 animate-spin" /> : <MessageCircleQuestion className="size-3" />}
      {mentor.busy ? "Asking… · جارٍ السؤال" : "Explain with mentor · اشرح مع المرشد"}
    </button>
  );
}

/** One short line under the stats: source label, summary, fallback reason. */
export function WiringMentorSummary({ mentor }: { mentor: WiringMentor }) {
  if (mentor.busy && !mentor.help)
    return (
      <div className="mx-3 mt-2 text-[11px]">
        <StillWorking active />
      </div>
    );
  const help = mentor.help;
  if (!help) return null;
  return (
    <div className="mx-3 mt-2 space-y-1 rounded-md border border-primary/30 bg-primary/5 p-2" aria-label="Mentor wiring help">
      <div className="flex flex-wrap items-center gap-1.5">
        <MessageCircleQuestion className="size-3.5 text-primary" />
        <span className="text-xs font-semibold">Mentor · المرشد</span>
        <AiSourceLabel source={help.source} local="rules" />
      </div>
      <p dir={mentor.dir} className="text-[11px] leading-snug">
        {help.summary}
      </p>
      <FallbackReasonNote reason={help.fallbackReason} onRetry={() => mentor.ask(true)} />
      <p className="text-[10px] text-muted-foreground">
        {mentor.issueCount > MAX_EXPLAINED ? `Only the first ${MAX_EXPLAINED} problems are explained. ` : ""}
        The check itself is rule-based; the circuit was not changed.
      </p>
    </div>
  );
}

/** The mentor's explanation and fix for one problem, shown inside its issue card. */
export function WiringMentorNote({ mentor, index }: { mentor: WiringMentor; index: number }) {
  const note = mentor.help?.notes.find((n) => n.index === index);
  if (!note) return null;
  return (
    <div dir={mentor.dir} className="mt-1.5 space-y-0.5 border-t border-dashed pt-1.5 text-[11px] leading-snug">
      <div>{note.explanation}</div>
      <div className="font-medium text-success">✓ {note.fix}</div>
    </div>
  );
}

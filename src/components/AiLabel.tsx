import { useEffect, useState } from "react";
import { Hourglass, Loader2, RotateCcw, Sparkles, Target } from "lucide-react";
import { DEFAULT_TIMEOUT_MS, STILL_WORKING_MS } from "@/lib/suggest/config";
import { quizFallbackReasons } from "@/components/journey/Personalization";
import { Button } from "@/components/ui/button";
import type { FallbackReason } from "@/lib/suggest/types";

/** Honest source label: "AI-generated" for Gemini output (also when cached), local otherwise. */
export function AiSourceLabel({
  source,
  local = "content",
}: {
  source: "ai" | "local";
  /** Wording of the local label: prewritten content or rule-based output. */
  local?: "content" | "rules";
}) {
  return source === "ai" ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-mint px-2.5 py-0.5 text-[11px] font-semibold text-mint-foreground">
      <Sparkles size={12} /> AI-generated <span dir="rtl">· مُولَّد بالذكاء الاصطناعي</span>
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-2.5 py-0.5 text-[11px] font-semibold">
      <Target size={12} />
      {local === "rules" ? (
        <>
          Based on local rules <span dir="rtl">· بناءً على قواعد محلية</span>
        </>
      ) : (
        <>
          Local content <span dir="rtl">· محتوى محلي</span>
        </>
      )}
    </span>
  );
}

/** Shown after 15 s of waiting for Gemini, so a slow answer doesn't look like a hang. */
export function StillWorking({ active }: { active: boolean }) {
  const [late, setLate] = useState(false);
  useEffect(() => {
    setLate(false);
    if (!active) return;
    const timer = setTimeout(() => setLate(true), STILL_WORKING_MS);
    return () => clearTimeout(timer);
  }, [active]);
  if (!active || !late) return null;
  const seconds = Math.round(DEFAULT_TIMEOUT_MS / 1000);
  return (
    <span role="status" className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
      <Hourglass size={12} /> Still working… Gemini can take up to {seconds} s{" "}
      <span dir="rtl">· لا يزال يعمل… قد يستغرق Gemini حتى {seconds} ثانية</span>
    </span>
  );
}

const reasonText = (reason: FallbackReason) =>
  reason === "bad-response"
    ? { en: "Gemini's answer didn't pass validation", ar: "لم يجتز رد Gemini التحقق" }
    : quizFallbackReasons[reason];

/** Why Gemini wasn't used, with an optional one-request "Try Gemini again". */
export function FallbackReasonNote({
  reason,
  onRetry,
}: {
  reason?: FallbackReason | undefined;
  onRetry?: (() => Promise<unknown>) | undefined;
}) {
  const [busy, setBusy] = useState(false);
  if (!reason) return null;
  const text = reasonText(reason);
  return (
    <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
      Gemini wasn't used: {text.en}. <span dir="rtl">لم يُستخدم Gemini: {text.ar}.</span>
      {onRetry && reason !== "missing-key" && (
        <Button
          size="sm"
          variant="ghost"
          className="ms-1 h-6 px-2 text-[11px]"
          disabled={busy}
          onClick={() => {
            setBusy(true);
            void onRetry().finally(() => setBusy(false));
          }}
        >
          {busy ? <Loader2 size={12} className="animate-spin" /> : <RotateCcw size={12} />} Try Gemini again · أعد المحاولة
        </Button>
      )}
    </p>
  );
}

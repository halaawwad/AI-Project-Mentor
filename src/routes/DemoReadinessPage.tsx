import { useState } from "react";
import { CheckCircle2, CircleDashed, Loader2, PlayCircle, Trash2, TriangleAlert } from "lucide-react";
import { StillWorking } from "@/components/AiLabel";
import { quizFallbackReasons } from "@/components/journey/Personalization";
import { thinkingConfigFor } from "@/lib/suggest/aiEngine";
import { useAiCallLogs } from "@/lib/suggest/diagnostics";
import { JourneyLayout } from "@/components/journey/JourneyUi";
import { Button } from "@/components/ui/button";
import { aiCacheEntries, clearAiCache, useAiCacheVersion } from "@/lib/ai/cache";
import { DEMO_COMPONENT, demoSteps, isCached, prepareDemo, type DemoProgress } from "@/lib/ai/demo";
import { useJourney } from "@/lib/journey/store";
import { readAiConfig } from "@/lib/suggest/config";
import type { FallbackReason } from "@/lib/suggest/types";
import { useDocumentTitle } from "@/lib/useDocumentTitle";

const reasonText = (reason: FallbackReason) =>
  reason === "bad-response" ? { en: "the answer didn't pass validation", ar: "لم يجتز الرد التحقق" } : quizFallbackReasons[reason];

/** Lists which AI results the scripted demo needs, which are cached, and prepares the missing ones. */
export function DemoReadinessPage() {
  useDocumentTitle("Demo readiness | AiPM");
  useAiCacheVersion();
  const language = useJourney().language;
  const steps = demoSteps(language);
  const missing = steps.filter((s) => !isCached(s, language));
  const hasKey = Boolean(readAiConfig().apiKey);
  const [running, setRunning] = useState(false);
  const [log, setLog] = useState<DemoProgress[]>([]);
  const [outcome, setOutcome] = useState<{ requests: number; stopped: FallbackReason | null } | null>(null);
  const run = async () => {
    setRunning(true);
    setLog([]);
    setOutcome(null);
    try {
      setOutcome(await prepareDemo({ language, onProgress: (p) => setLog((current) => [...current, p]) }));
    } finally {
      setRunning(false);
    }
  };
  const failed = (step: (typeof steps)[number]) =>
    log.find((p) => p.step.feature === step.feature && p.step.checkpoint === step.checkpoint && p.status === "fallback");
  const calls = useAiCallLogs();
  const settings = readAiConfig();
  const thinking = thinkingConfigFor(settings.model);
  const last = log.at(-1);
  const current = running && last?.status === "requesting" ? last.step : null;
  /** The HTTP status of the latest failed call for this step's feature, if any. */
  const statusOf = (step: (typeof steps)[number], reason: FallbackReason) =>
    calls.find((c) => c.feature === step.feature && c.outcome === reason)?.status;

  return (
    <JourneyLayout
      active="Demo Readiness"
      eyebrow="PRESENTATION"
      title="Demo readiness"
      arabic="جاهزية العرض التجريبي"
      actions={
        <div className="flex flex-wrap gap-2">
          <Button disabled={running || !missing.length || !hasKey} onClick={() => void run()}>
            {running ? <Loader2 size={15} className="animate-spin" /> : <PlayCircle size={15} />} Prepare missing ({missing.length})
          </Button>
          <Button
            variant="ghost"
            className="text-destructive"
            disabled={running || !aiCacheEntries().length}
            onClick={() => {
              if (window.confirm("Clear the AI cache? Every cached Gemini result is removed. Your journey is kept.")) clearAiCache();
            }}
          >
            <Trash2 size={14} /> Clear AI cache · مسح ذاكرة الذكاء الاصطناعي
          </Button>
        </div>
      }
    >
      <section className="glass-panel rounded-[22px] p-5 text-sm">
        <p>
          Every successful Gemini result is cached per checkpoint and language ({language === "ar" ? "Arabic" : "English"} now) and survives
          reloads and <b>Reset demo</b>. A cached result is still validated against your real answers before it is shown, and it is labelled
          "AI-generated". <b>Prepare missing</b> walks the scripted demo below, one Gemini request at a time with a 4-second pause, and stops at
          the free limit or a key problem (no retries).
        </p>
        <p dir="rtl" className="mt-1 text-xs text-muted-foreground">
          تُحفظ كل نتيجة ناجحة من Gemini لكل متعلم ومرحلة ولغة، وتبقى بعد إعادة التحميل وإعادة ضبط العرض. يتم التحقق منها قبل عرضها.
        </p>
        <details className="mt-3 text-xs">
          <summary className="cursor-pointer font-semibold">Scripted demo (follow it to hit the cache) · سيناريو العرض</summary>
          <ul className="mt-1 list-disc space-y-0.5 ps-5">
            <li>Traffic light. Self-rating: "I've built a few simple circuits", every placement answer right.</li>
            <li>
              Stage 1, first quiz: get exactly 2 wrong (questions tagged LED polarity first, then the earliest questions). Always pick
              the first option that is wrong.
            </li>
            <li>Retry: get exactly 1 wrong the same way, which passes with 80%.</li>
            <li>3D Lab: place an Arduino Uno, wire 5V → D2, run Validate Wiring, then "Explain with mentor".</li>
            <li>New component: "{DEMO_COMPONENT}".</li>
            <li>To show personalization live, answer differently (for example miss Ohm's law instead): that makes one live request.</li>
          </ul>
        </details>
        {!hasKey && (
          <p className="mt-2 flex items-center gap-1.5 text-xs text-warning">
            <TriangleAlert size={13} /> No Gemini key is set, so nothing can be prepared; cached results still work.
          </p>
        )}
        <p className="mt-2 text-[11px] text-muted-foreground">
          Model <code>{settings.model}</code> · timeout {Math.round(settings.timeoutMs / 1000)} s · thinking{" "}
          {thinking?.thinkingLevel ? `level ${String(thinking.thinkingLevel).toLowerCase()}` : thinking ? `budget ${thinking.thinkingBudget}` : "model default"}
        </p>
        {current && (
          <p role="status" className="mt-2 flex flex-wrap items-center gap-2 text-xs font-semibold">
            <Loader2 size={13} className="animate-spin" /> Requesting: {current.label.en}
            <StillWorking active />
          </p>
        )}
        {outcome && (
          <p role="status" className="mt-2 text-xs font-semibold">
            {outcome.requests} request{outcome.requests === 1 ? "" : "s"} sent.
            {outcome.stopped ? ` Stopped: ${reasonText(outcome.stopped).en}.` : " Done."}
          </p>
        )}
      </section>

      {!!calls.length && (
        <section className="glass-panel overflow-x-auto rounded-[22px] p-5" aria-label="Gemini calls">
          <h2 className="text-sm font-bold">
            Gemini calls this session <span dir="rtl" className="font-normal">· طلبات Gemini في هذه الجلسة</span>
          </h2>
          <table className="mt-2 w-full text-left text-[11px]">
            <thead className="text-muted-foreground">
              <tr>
                <th className="py-1">Time</th>
                <th className="py-1">Feature</th>
                <th className="py-1">Model</th>
                <th className="py-1">Duration</th>
                <th className="py-1">Result</th>
                <th className="py-1">HTTP</th>
                <th className="py-1">Detail</th>
              </tr>
            </thead>
            <tbody>
              {calls.map((c) => (
                <tr key={`${c.at}-${c.feature}`} className="border-t border-border align-top">
                  <td className="py-1 pe-2 font-mono">{new Date(c.at).toLocaleTimeString()}</td>
                  <td className="py-1 pe-2">{c.feature}</td>
                  <td className="py-1 pe-2 font-mono">{c.model}</td>
                  <td className="py-1 pe-2 font-mono">{(c.durationMs / 1000).toFixed(1)} s</td>
                  <td className={`py-1 pe-2 font-semibold ${c.outcome === "ok" ? "text-success" : "text-destructive"}`}>
                    {c.outcome === "ok" ? "ok" : `${c.outcome} — ${reasonText(c.outcome).en}`}
                  </td>
                  <td className="py-1 pe-2 font-mono">{c.status ?? "—"}</td>
                  <td className="py-1 text-muted-foreground">{c.detail ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <section className="glass-panel rounded-[22px] p-5" aria-label="Demo results">
        <h2 className="text-sm font-bold">
          Demo results <span dir="rtl" className="font-normal">· نتائج العرض</span> ·{" "}
          {steps.filter((s) => isCached(s, language)).length} / {steps.length} cached
        </h2>
        <ol className="mt-2 grid gap-1.5 xl:grid-cols-2">
          {steps.map((step) => {
            const cached = isCached(step, language);
            const problem = failed(step);
            return (
              <li key={`${step.feature}-${step.checkpoint}`} className="glass-inset flex items-start gap-2 rounded-lg px-3 py-2 text-xs">
                {cached ? (
                  <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-success" />
                ) : (
                  <CircleDashed size={15} className="mt-0.5 shrink-0 text-muted-foreground" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{step.label.en}</p>
                  <p dir="rtl" className="text-muted-foreground">
                    {step.label.ar}
                  </p>
                  {problem?.status === "fallback" && (
                    <p className="text-destructive">
                      Not cached: {problem.reason}
                      {statusOf(step, problem.reason) ? ` (HTTP ${statusOf(step, problem.reason)})` : ""} — {reasonText(problem.reason).en}
                    </p>
                  )}
                  {current?.feature === step.feature && current.checkpoint === step.checkpoint && (
                    <StillWorking active />
                  )}
                </div>
                <span className={`shrink-0 font-semibold ${cached ? "text-success" : "text-muted-foreground"}`}>
                  {cached ? "Cached (AI)" : "Missing"}
                </span>
              </li>
            );
          })}
        </ol>
      </section>
    </JourneyLayout>
  );
}

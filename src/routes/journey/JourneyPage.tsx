import { Link } from "@tanstack/react-router";
import { ArrowRight, CheckCircle2, CircleDot, Lock, PackageSearch, Trophy } from "lucide-react";
import { DemoBadge, JourneyLayout, ResetDemoButton } from "@/components/journey/JourneyUi";
import { Button } from "@/components/ui/button";
import { allPassed, stageStatuses } from "@/lib/journey/grading";
import { levelInfo } from "@/lib/journey/level";
import { buildPath } from "@/lib/journey/path";
import { useJourney } from "@/lib/journey/store";
import { PASS_MARK } from "@/lib/journey/types";
import { useDocumentTitle } from "@/lib/useDocumentTitle";

/** Learning path and progress: locked / current / passed stages with scores and attempts. */
export function JourneyPage() {
  useDocumentTitle("Learning journey | AiPM");
  const journey = useJourney();
  const stages = buildPath(journey);
  const statuses = stageStatuses(stages, journey.progress);
  const done = allPassed(stages, journey.progress);

  if (!journey.project || !journey.level || !stages.length) {
    const step = !journey.project ? "idea" : !journey.parts.length ? "parts" : "level";
    return (
      <JourneyLayout step={step} eyebrow="LEARNING JOURNEY" title="Start your journey" arabic="ابدأ رحلتك" actions={<ResetDemoButton />}>
        <section className="glass-panel rounded-[22px] p-6 text-sm">
          <p>
            {!journey.project || !journey.parts.length
              ? "Pick how you want to start. Your learning path is built after the parts list and a quick level check."
              : "Take the quick level check to build your learning path."}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {journey.project && journey.parts.length ? (
              <Button asChild>
                <Link to="/journey/level">Take the level check</Link>
              </Button>
            ) : (
              <>
                <Button asChild>
                  <Link to="/describe">I have a project idea</Link>
                </Button>
                <Button variant="secondary" asChild>
                  <Link to="/journey/choose">I don't have an idea yet</Link>
                </Button>
              </>
            )}
          </div>
        </section>
      </JourneyLayout>
    );
  }

  const current = stages.find((_, i) => statuses[i] === "current");
  const generated = stages.some((s) => s.source === "generated");
  return (
    <JourneyLayout
      step={done ? "ready" : "path"}
      eyebrow={`LEARNING PATH · ${levelInfo[journey.level].title.en.toUpperCase()}`}
      title={journey.project.title.en}
      arabic={journey.project.title.ar}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <DemoBadge generated={generated} />
          <ResetDemoButton />
        </div>
      }
    >
      <section className="glass-panel rounded-[22px] p-5">
        <p className="text-sm">
          {stages.length} stages · pass each quiz with {PASS_MARK}% or more to unlock the next stage.{" "}
          {levelInfo[journey.level].path}
        </p>
        <p dir="rtl" className="text-xs text-muted-foreground">
          اجتز اختبار كل مرحلة بنسبة {PASS_MARK}% أو أكثر لفتح المرحلة التالية.
        </p>
        {generated && (
          <p className="mt-2 text-[11px] text-muted-foreground">
            No written path matches this project, so the stages and quizzes are generated from your
            approved parts using catalog and connection-sheet data.
          </p>
        )}
        <ol className="mt-4 space-y-2">
          {stages.map((stage, i) => {
            const status = statuses[i]!;
            const progress = journey.progress[stage.id];
            const Icon = status === "passed" ? CheckCircle2 : status === "current" ? CircleDot : Lock;
            return (
              <li
                key={stage.id}
                className={`glass-inset flex flex-wrap items-center gap-3 rounded-xl p-3 ${status === "locked" ? "opacity-60" : ""}`}
              >
                <Icon size={20} className={status === "passed" ? "text-success" : status === "current" ? "text-primary" : "text-muted-foreground"} />
                <div className="min-w-[12rem] flex-1">
                  <p className="text-[10px] font-semibold tracking-[0.14em] text-muted-foreground">
                    STAGE {i + 1} · {status.toUpperCase()}
                  </p>
                  <strong className="text-sm">{stage.title.en}</strong>{" "}
                  <span dir="rtl" className="text-xs text-muted-foreground">
                    · {stage.title.ar}
                  </span>
                </div>
                <span className="text-xs text-muted-foreground">
                  {progress
                    ? `Best ${progress.bestScore}% · ${progress.attempts} attempt${progress.attempts === 1 ? "" : "s"}`
                    : "Not attempted"}
                </span>
                {status === "locked" ? (
                  <Button size="sm" variant="ghost" disabled>
                    <Lock size={13} /> Locked
                  </Button>
                ) : (
                  <Button size="sm" variant={status === "current" ? "default" : "secondary"} asChild>
                    <Link to="/journey/stage" search={{ id: stage.id }}>
                      {status === "current" ? "Continue" : "Review"} <ArrowRight size={13} />
                    </Link>
                  </Button>
                )}
              </li>
            );
          })}
        </ol>
        <div className="mt-4 flex flex-wrap gap-2">
          {done ? (
            <Button asChild>
              <Link to="/journey/ready">
                <Trophy size={15} /> Ready to build your project
              </Link>
            </Button>
          ) : (
            current && (
              <Button asChild>
                <Link to="/journey/stage" search={{ id: current.id }}>
                  Continue: {current.title.en} <ArrowRight size={14} />
                </Link>
              </Button>
            )
          )}
          <Button variant="ghost" asChild>
            <Link to="/journey/new-component">
              <PackageSearch size={14} /> Need a part that isn't in the catalog?
            </Link>
          </Button>
        </div>
      </section>
    </JourneyLayout>
  );
}

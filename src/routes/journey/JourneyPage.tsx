import { Link } from "@tanstack/react-router";
import { ArrowRight, CheckCircle2, CircleDot, Loader2, Lock, PackageSearch, Trophy } from "lucide-react";
import { StillWorking } from "@/components/AiLabel";
import { DemoBadge, JourneyLayout, ResetDemoButton } from "@/components/journey/JourneyUi";
import { ActionBadge, InsightSourceLabel, MentorAnalysisPanel, RemedialCard, WhatChanged } from "@/components/journey/Mentor";
import { SkillsPanel } from "@/components/journey/Personalization";
import { Button } from "@/components/ui/button";
import { allPassed, stageStatuses } from "@/lib/journey/grading";
import { levelInfo } from "@/lib/journey/level";
import { effectivePlan } from "@/lib/journey/mentor";
import { buildPath } from "@/lib/journey/path";
import { useJourney } from "@/lib/journey/store";
import { useMentorInsight } from "@/lib/journey/useMentor";
import { PASS_MARK, type PlanItem } from "@/lib/journey/types";
import { useDocumentTitle } from "@/lib/useDocumentTitle";

/** Learning path and progress: locked / current / passed stages with scores and attempts. */
export function JourneyPage() {
  useDocumentTitle("Learning journey | AiPM");
  const journey = useJourney();
  const lang = journey.language;
  const stages = buildPath(journey);
  const statuses = stageStatuses(stages, journey.progress);
  const done = allPassed(stages, journey.progress);
  // Right after the level check (and after each completed stage) this asks for one diagnosis + plan.
  const mentor = useMentorInsight(stages);

  if (!journey.project || !journey.level || !stages.length) {
    const step = !journey.project ? "idea" : !journey.parts.length ? "parts" : "level";
    return (
      <JourneyLayout step={step} eyebrow="Learning journey" title="Start your journey" arabic="ابدأ رحلتك" actions={<ResetDemoButton />}>
        <section className="glass-panel rounded-panel p-6 text-sm">
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
  const plan = effectivePlan(stages, mentor.shown);
  const planLang = mentor.shown?.language ?? lang;
  const items: PlanItem[] =
    plan ?? stages.map((stage) => ({ kind: "stage", target: stage.id, action: "keep", reason: "", explanation: "" }));
  return (
    <JourneyLayout
      step={done ? "ready" : "path"}
      eyebrow={`Learning path · ${levelInfo[journey.level].title.en}`}
      title={journey.project.title.en}
      arabic={journey.project.title.ar}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <DemoBadge generated={generated} />
          <ResetDemoButton />
        </div>
      }
    >
      <MentorAnalysisPanel mentor={mentor} language={lang} />
      <WhatChanged mentor={mentor} stages={stages} />
      <SkillsPanel profile={journey.profile} stages={stages} language={lang} />
      <section className="glass-panel rounded-panel p-5">
        {lang === "ar" ? (
          <p dir="rtl" className="text-sm">
            {stages.length} مراحل · اجتز اختبار كل مرحلة بنسبة {PASS_MARK}% أو أكثر لفتح المرحلة التالية.{" "}
            {levelInfo[journey.level].path.ar}
          </p>
        ) : (
          <p className="text-sm">
            {stages.length} stages · pass each quiz with {PASS_MARK}% or more to unlock the next stage.{" "}
            {levelInfo[journey.level].path.en}
          </p>
        )}
        {generated && (
          <p dir={lang === "ar" ? "rtl" : "ltr"} className="mt-2 text-[11px] text-muted-foreground">
            {lang === "ar"
              ? "لا يوجد مسار مكتوب يطابق هذا المشروع، لذا وُلّدت المراحل والاختبارات من القطع المعتمدة باستخدام بيانات الكتالوج وأوراق التوصيل."
              : "No written path matches this project, so the stages and quizzes are generated from your approved parts using catalog and connection-sheet data."}
          </p>
        )}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <h2 className="text-sm font-bold">
            Your plan <span dir="rtl" className="font-normal">· خطتك</span>
          </h2>
          {plan && mentor.shown ? (
            <InsightSourceLabel source={mentor.shown.source} kind="plan" />
          ) : (
            mentor.preparing && (
              <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <Loader2 className="animate-spin" size={12} /> Preparing your plan… · جارٍ تجهيز خطتك… <StillWorking active />
              </span>
            )
          )}
        </div>
        <ol className="mt-2 space-y-2">
          {items.map((item) => {
            if (item.kind === "remedial")
              return (
                <li key={`remedial-${item.target}`}>
                  <RemedialCard item={item} stages={stages} language={planLang} />
                </li>
              );
            const i = stages.findIndex((s) => s.id === item.target);
            const stage = stages[i]!;
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
                  <p className="flex flex-wrap items-center gap-1.5 text-xs font-medium text-muted-foreground">
                    Stage {i + 1} · {status} <ActionBadge action={status === "passed" ? "keep" : item.action} />
                  </p>
                  <strong dir={lang === "ar" ? "rtl" : "ltr"} className="text-sm">
                    {stage.title[lang]}
                  </strong>{" "}
                  <span dir={lang === "ar" ? "ltr" : "rtl"} className="text-xs text-muted-foreground">
                    · {stage.title[lang === "ar" ? "en" : "ar"]}
                  </span>
                  {item.reason && (
                    <p dir={planLang === "ar" ? "rtl" : "ltr"} className="mt-0.5 text-xs text-muted-foreground">
                      {item.reason}
                    </p>
                  )}
                  {item.action === "skippable" && status !== "passed" && (
                    <p dir={lang === "ar" ? "rtl" : "ltr"} className="mt-0.5 text-[11px] font-semibold">
                      {lang === "ar"
                        ? `يمكنك تخطي الدرس: اجتز اختبار المرحلة بنسبة ${PASS_MARK}% مباشرة.`
                        : `You can skip the lesson: pass this stage's quiz with ${PASS_MARK}% directly.`}
                    </p>
                  )}
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

import { useState } from "react";
import {
  BookMarked,
  Brain,
  FastForward,
  GitCompareArrows,
  Loader2,
  PlusCircle,
  RotateCcw,
  Scissors,
  ThumbsUp,
  Target,
  TriangleAlert,
} from "lucide-react";
import { StillWorking } from "@/components/AiLabel";
import { quizFallbackReasons } from "@/components/journey/Personalization";
import { Button } from "@/components/ui/button";
import { skillLabel } from "@/lib/journey/i18n";
import { describeChanges, planChanges, remedialLesson } from "@/lib/journey/mentor";
import type { useMentorInsight } from "@/lib/journey/useMentor";
import type { Confidence, InsightSource, Language, MentorInsight, PlanAction, PlanItem, Stage } from "@/lib/journey/types";

type Mentor = ReturnType<typeof useMentorInsight>;
const dirOf = (language: Language) => (language === "ar" ? "rtl" : "ltr");

/** Honest label: Gemini output is AI; the fallback is the local rules. */
export function InsightSourceLabel({ source, kind }: { source: InsightSource; kind: "analysis" | "plan" }) {
  if (source === "local")
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-xs font-semibold">
        <Target size={13} /> Based on local rules <span dir="rtl">· بناءً على قواعد محلية</span>
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-mint px-3 py-1 text-xs font-semibold text-mint-foreground">
      <Brain size={13} />
      {kind === "analysis" ? (
        <>
          AI analysis <span dir="rtl">· تحليل بالذكاء الاصطناعي</span>
        </>
      ) : (
        <>
          AI-personalized plan <span dir="rtl">· خطة مخصّصة بالذكاء الاصطناعي</span>
        </>
      )}
    </span>
  );
}

const confidenceNames: Record<Confidence, { en: string; ar: string }> = {
  low: { en: "Low confidence", ar: "ثقة منخفضة" },
  medium: { en: "Medium confidence", ar: "ثقة متوسطة" },
  high: { en: "High confidence", ar: "ثقة عالية" },
};

function FallbackNote({ insight, onRetry }: { insight: MentorInsight; onRetry: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  if (!insight.fallbackReason) return null;
  const reason =
    insight.fallbackReason === "bad-response"
      ? { en: "Gemini's analysis didn't pass validation", ar: "لم يجتز تحليل Gemini التحقق" }
      : quizFallbackReasons[insight.fallbackReason];
  return (
    <div className="mt-3 text-[11px] leading-5 text-muted-foreground">
      <p>
        Gemini wasn't used: {reason.en}. This analysis and plan come from the local rules.
        <span dir="rtl" className="block">
          لم يُستخدم Gemini: {reason.ar}. هذا التحليل والخطة من القواعد المحلية.
        </span>
      </p>
      {insight.fallbackReason !== "missing-key" && (
        <Button
          size="sm"
          variant="ghost"
          className="mt-1"
          disabled={busy}
          onClick={() => {
            setBusy(true);
            void onRetry().finally(() => setBusy(false));
          }}
        >
          {busy ? <Loader2 className="animate-spin" size={13} /> : <RotateCcw size={13} />} Try Gemini again (one request) ·
          أعد المحاولة
        </Button>
      )}
    </div>
  );
}

/** "Mentor analysis": strengths, weak skills, misconceptions and confidence for this learner. */
export function MentorAnalysisPanel({ mentor, language }: { mentor: Mentor; language: Language }) {
  const insight = mentor.shown;
  if (!insight)
    return mentor.preparing ? (
      <section className="glass-panel rounded-[22px] p-5" aria-label="Mentor analysis" aria-busy="true">
        <p className="flex items-center gap-2 text-sm">
          <Loader2 className="animate-spin" size={16} /> Analysing your answers… · جارٍ تحليل إجاباتك…{" "}
          <StillWorking active />
        </p>
      </section>
    ) : null;
  const d = insight.diagnosis;
  const lang = insight.language;
  const dir = dirOf(lang);
  const ai = insight.source === "ai";
  return (
    <section className="glass-panel rounded-[22px] p-5" aria-label="Mentor analysis">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="flex items-center gap-2 text-base font-bold">
          <Brain size={17} /> Mentor analysis <span dir="rtl" className="font-normal">· تحليل المرشد</span>
        </h2>
        <InsightSourceLabel source={insight.source} kind="analysis" />
        <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${d.confidence === "low" ? "bg-soft-amber" : "bg-soft-blue"}`}>
          {confidenceNames[d.confidence][language]}
        </span>
      </div>
      {mentor.stale && (
        <p className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground" aria-busy="true">
          <Loader2 className="animate-spin" size={12} /> Updating with your latest answers… · جارٍ التحديث بإجاباتك الأخيرة…{" "}
          <StillWorking active />
        </p>
      )}
      <p dir={dir} className="mt-2 text-sm leading-7">
        {d.summary}
      </p>
      <div className="mt-3 grid gap-3 md:grid-cols-3">
        <div className="glass-inset rounded-xl p-3">
          <h3 className="flex items-center gap-1.5 text-sm font-semibold">
            <ThumbsUp size={14} /> Strengths <span dir="rtl" className="font-normal">· نقاط القوة</span>
          </h3>
          <SkillList skills={d.strengths} language={lang} empty={lang === "ar" ? "لا توجد بعد" : "None yet"} />
        </div>
        <div className="glass-inset rounded-xl p-3">
          <h3 className="flex items-center gap-1.5 text-sm font-semibold">
            <Target size={14} /> Weak skills <span dir="rtl" className="font-normal">· مهارات تحتاج تحسيناً</span>
          </h3>
          <SkillList skills={d.weakSkills} language={lang} empty={lang === "ar" ? "لا توجد بعد" : "None yet"} />
        </div>
        <div className="glass-inset rounded-xl p-3">
          <h3 className="flex items-center gap-1.5 text-sm font-semibold">
            <TriangleAlert size={14} />
            {ai ? (
              <>
                Likely misconceptions <span dir="rtl" className="font-normal">· مفاهيم خاطئة محتملة</span>
              </>
            ) : (
              <>
                Recent mistakes <span dir="rtl" className="font-normal">· أخطاء حديثة</span>
              </>
            )}
          </h3>
          {d.misconceptions.length ? (
            <ul dir={dir} className="mt-1 space-y-1 text-sm">
              {d.misconceptions.map((m) => (
                <li key={`${m.skill}-${m.text}`}>
                  <span className="text-[11px] font-semibold text-muted-foreground">{skillLabel(m.skill, lang)}:</span> {m.text}
                </li>
              ))}
            </ul>
          ) : (
            <p dir={dir} className="mt-1 text-sm text-muted-foreground">
              {lang === "ar" ? "لا توجد إجابات خاطئة بعد." : "No wrong answers yet."}
            </p>
          )}
        </div>
      </div>
      <p dir={dir} className="mt-2 text-[11px] text-muted-foreground">
        {d.confidenceNote}
      </p>
      <FallbackNote insight={insight} onRetry={mentor.retry} />
    </section>
  );
}

function SkillList({ skills, language, empty }: { skills: string[]; language: Language; empty: string }) {
  return skills.length ? (
    <ul dir={dirOf(language)} className="mt-1 flex flex-wrap gap-1.5">
      {skills.map((skill) => (
        <li key={skill} className="rounded-full bg-card px-2.5 py-0.5 text-xs">
          {skillLabel(skill, language)}
        </li>
      ))}
    </ul>
  ) : (
    <p dir={dirOf(language)} className="mt-1 text-sm text-muted-foreground">
      {empty}
    </p>
  );
}

const actionBadges: Record<Exclude<PlanAction, "keep">, { en: string; ar: string; className: string; Icon: typeof Scissors }> = {
  "add-remedial": { en: "Added", ar: "مُضاف", className: "bg-soft-rose", Icon: PlusCircle },
  shorten: { en: "Shortened", ar: "مختصرة", className: "bg-soft-blue", Icon: Scissors },
  skippable: { en: "Skippable", ar: "يمكن تخطيها", className: "bg-mint text-mint-foreground", Icon: FastForward },
};

export function ActionBadge({ action }: { action: PlanAction }) {
  if (action === "keep") return null;
  const badge = actionBadges[action];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${badge.className}`}>
      <badge.Icon size={11} /> {badge.en} <span dir="rtl">· {badge.ar}</span>
    </span>
  );
}

/** "What changed and why": the model's (or the rules') note plus the computed differences. */
export function WhatChanged({ mentor, stages }: { mentor: Mentor; stages: Stage[] }) {
  const insight = mentor.insight;
  if (!insight || !mentor.previous) return null;
  const lang = insight.language;
  const changes = planChanges(mentor.previous.items, insight.plan.items);
  return (
    <section className="glass-panel rounded-[22px] border-s-4 border-primary p-4" aria-label="What changed and why">
      <h2 className="flex items-center gap-2 text-sm font-bold">
        <GitCompareArrows size={15} /> What changed and why <span dir="rtl" className="font-normal">· ما الذي تغيّر ولماذا</span>
      </h2>
      <p dir={dirOf(lang)} className="mt-1 text-sm">
        {insight.plan.changeNote}
      </p>
      <p dir={dirOf(lang)} className="mt-1 text-[11px] text-muted-foreground">
        {changes.length
          ? describeChanges(changes, stages, lang)
          : lang === "ar"
            ? "ترتيب المراحل والإجراءات لم يتغيّر."
            : "Stages and actions are unchanged."}
      </p>
    </section>
  );
}

/** A remedial mini-lesson: local skill notes, plus Gemini's personalized explanation when there is one. */
export function RemedialCard({ item, stages, language }: { item: PlanItem; stages: Stage[]; language: Language }) {
  const [open, setOpen] = useState(false);
  const lesson = remedialLesson(stages, item.target, language);
  const dir = dirOf(language);
  return (
    <div className="glass-inset rounded-xl border border-dashed border-border p-3">
      <div className="flex flex-wrap items-center gap-2">
        <BookMarked size={18} className="text-primary" />
        <strong dir={dir} className="text-sm">
          {language === "ar" ? "درس قصير: " : "Mini-lesson: "}
          {skillLabel(item.target, language)}
        </strong>
        <ActionBadge action="add-remedial" />
        <Button size="sm" variant="ghost" className="ms-auto" aria-expanded={open} onClick={() => setOpen(!open)}>
          {open ? "Hide · إخفاء" : "Open · افتح"}
        </Button>
      </div>
      <p dir={dirOf(language)} className="mt-1 text-xs text-muted-foreground">
        {item.reason}
      </p>
      {open && (
        <div dir={dir} className="mt-2 space-y-2 text-sm leading-7">
          {item.explanation && (
            <p>
              <span className="me-1 rounded-full bg-mint px-2 py-0.5 text-[10px] font-semibold text-mint-foreground">
                {language === "ar" ? "شرح مخصّص بالذكاء الاصطناعي" : "AI explanation for you"}
              </span>
              {item.explanation}
            </p>
          )}
          {!!lesson.notes.length && (
            <ul className="list-disc ps-5">
              {lesson.notes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          )}
          {lesson.analogy && <p className="text-muted-foreground">{lesson.analogy}</p>}
          <p className="text-[11px] text-muted-foreground">
            {language === "ar"
              ? "الدرس القصير للقراءة ولا يقفل أي مرحلة؛ يبقى النجاح في الاختبار بنسبة 80% هو شرط الانتقال."
              : "Mini-lessons are for reading and don't lock any stage; passing each quiz with 80% is still what unlocks the next."}
          </p>
        </div>
      )}
    </div>
  );
}

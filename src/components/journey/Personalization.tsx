import { Gauge, Languages, Lightbulb, Sparkles, Target, Wrench } from "lucide-react";
import { difficultyLabel, masteryOf, stageSkills, whyThisQuiz } from "@/lib/journey/adaptive";
import { skillLabel } from "@/lib/journey/i18n";
import { setJourneyLanguage } from "@/lib/journey/store";
import type { Language, LearnerProfile, PersonalizedQuiz, Stage } from "@/lib/journey/types";
import type { FallbackReason } from "@/lib/suggest/types";

/** Short reasons for using local content instead of a Gemini quiz. */
export const quizFallbackReasons: Record<FallbackReason, { en: string; ar: string }> = {
  "missing-key": { en: "no Gemini API key is set (VITE_GEMINI_API_KEY)", ar: "لم يتم ضبط مفتاح Gemini API" },
  "invalid-key": { en: "the API key was rejected", ar: "تم رفض مفتاح API" },
  permission: { en: "the key can't use this model", ar: "المفتاح لا يستطيع استخدام هذا النموذج" },
  "rate-limit": { en: "free limit reached, try again shortly", ar: "تم بلوغ الحد المجاني، أعد المحاولة بعد قليل" },
  timeout: { en: "Gemini didn't answer within 90 s", ar: "لم يرد Gemini خلال 90 ثانية" },
  network: { en: "Gemini couldn't be reached", ar: "تعذر الوصول إلى Gemini" },
  unavailable: { en: "Gemini is temporarily unavailable (503)", ar: "خدمة Gemini غير متاحة مؤقتاً (503)" },
  "server-error": { en: "Gemini had a server error", ar: "حدث خطأ في خادم Gemini" },
  "model-not-found": { en: "the model wasn't found (check VITE_GEMINI_MODEL)", ar: "لم يُعثر على النموذج (تحقق من VITE_GEMINI_MODEL)" },
  "bad-request": { en: "Gemini rejected the request (check VITE_GEMINI_MODEL)", ar: "رفض Gemini الطلب (تحقق من VITE_GEMINI_MODEL)" },
  blocked: { en: "Gemini's safety filters blocked the answer", ar: "حجبت فلاتر الأمان في Gemini الرد" },
  empty: { en: "Gemini returned an empty answer", ar: "أعاد Gemini رداً فارغاً" },
  "bad-response": { en: "Gemini's quiz didn't pass validation", ar: "لم يجتز اختبار Gemini التحقق" },
};

/** Honest source label: Gemini content is AI; local selection is not. */
export function PersonalSourceLabel({ quiz }: { quiz: PersonalizedQuiz }) {
  return quiz.source === "ai" ? (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-mint px-3 py-1 text-xs font-semibold text-mint-foreground">
      <Sparkles size={13} /> AI-generated for you <span dir="rtl">· مُولَّد لك بالذكاء الاصطناعي</span>
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-xs font-semibold">
      <Target size={13} /> Selected for you from local content <span dir="rtl">· مختار لك من المحتوى المحلي</span>
    </span>
  );
}

/** "Why this quiz": the adaptive decision, the source, and the explanation and task before it. */
export function WhyThisQuizCard({ quiz }: { quiz: PersonalizedQuiz }) {
  const why = whyThisQuiz(quiz.plan);
  const fallback = quiz.fallbackReason ? quizFallbackReasons[quiz.fallbackReason] : null;
  // Local and Gemini content are both written in the quiz's language.
  const dir = quiz.language === "ar" ? "rtl" : "ltr";
  const lang = quiz.language;
  return (
    <section className="glass-panel rounded-[22px] p-5" aria-label="Why this quiz">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-base font-bold">
          Why this quiz <span dir="rtl" className="font-normal">· لماذا هذا الاختبار</span>
        </h2>
        <PersonalSourceLabel quiz={quiz} />
        <span className="inline-flex items-center gap-1 rounded-full bg-soft-blue px-2.5 py-1 text-[11px] font-semibold">
          <Gauge size={12} /> {difficultyLabel(quiz.plan.difficulty).en} · {difficultyLabel(quiz.plan.difficulty).ar}
        </span>
      </div>
      <p dir={dir} className="mt-2 text-sm">
        {why[lang]}
      </p>
      <p dir={lang === "ar" ? "ltr" : "rtl"} className="text-xs text-muted-foreground">
        {why[lang === "ar" ? "en" : "ar"]}
      </p>
      {!!quiz.plan.focusSkills.length && (
        <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="Focus skills">
          {quiz.plan.focusSkills.map((skill) => (
            <li key={skill} className="rounded-full bg-soft-amber px-2.5 py-0.5 text-[11px] font-semibold">
              {skillLabel(skill, lang)}
            </li>
          ))}
          {quiz.plan.reviewSkill && (
            <li className="rounded-full bg-soft-rose px-2.5 py-0.5 text-[11px] font-semibold">
              {lang === "ar" ? "مراجعة" : "Review"}: {skillLabel(quiz.plan.reviewSkill, lang)}
            </li>
          )}
        </ul>
      )}
      {fallback && (
        <p className="mt-2 text-[11px] leading-5 text-muted-foreground">
          Gemini wasn't used: {fallback.en}. Questions were selected from local content instead.
          <span dir="rtl" className="block">
            لم يُستخدم Gemini: {fallback.ar}. اختيرت الأسئلة من المحتوى المحلي بدلاً من ذلك.
          </span>
        </p>
      )}
      <h3 className="mt-4 flex items-center gap-1.5 text-sm font-semibold">
        <Lightbulb size={14} /> {quiz.source === "ai" ? "Explained for you" : "Explanation for your weakest skill"}{" "}
        <span dir="rtl" className="font-normal">· شرح لنقاط ضعفك</span>
      </h3>
      <p dir={dir} className="mt-1 text-sm leading-7">
        {quiz.explanation}
      </p>
      <h3 className="mt-3 flex items-center gap-1.5 text-sm font-semibold">
        <Wrench size={14} /> Practice task <span dir="rtl" className="font-normal">· تمرين عملي</span>
      </h3>
      <p dir={dir} className="mt-1 text-sm">
        {quiz.practiceTask}
      </p>
    </section>
  );
}

/** Mastery bars per skill and the current difficulty. */
export function SkillsPanel({
  profile,
  stages,
  language,
  title = "Your skills",
}: {
  profile: LearnerProfile | null;
  stages: Stage[];
  language: Language;
  title?: string;
}) {
  if (!profile) return null;
  const skills = [...new Set(stages.flatMap(stageSkills))];
  const assessed = skills.filter((skill) => profile.mastery[skill] !== undefined);
  const pending = skills.length - assessed.length;
  return (
    <section className="glass-panel rounded-[22px] p-5" aria-label="Skills and mastery">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-sm font-bold">
          {title} <span dir="rtl" className="font-normal">· مهاراتك</span>
        </h2>
        <span className="inline-flex items-center gap-1 rounded-full bg-soft-blue px-2.5 py-0.5 text-[11px] font-semibold">
          <Gauge size={12} /> Difficulty: {difficultyLabel(profile.difficulty).en} · {difficultyLabel(profile.difficulty).ar}
        </span>
      </div>
      {assessed.length ? (
        <ul className="mt-3 grid gap-x-6 gap-y-2 md:grid-cols-2">
          {assessed.map((skill) => {
            const value = masteryOf(profile, skill);
            return (
              <li key={skill} className="text-xs">
                <div className="flex justify-between">
                  <span dir={language === "ar" ? "rtl" : "ltr"}>{skillLabel(skill, language)}</span>
                  <span className="font-mono">{value}</span>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={value} aria-label={`${skill} mastery`}>
                  <div
                    className={`h-full rounded-full ${value < 40 ? "bg-destructive" : value < 70 ? "bg-warning" : "bg-success"}`}
                    style={{ width: `${value}%` }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-2 text-xs text-muted-foreground">No skills assessed yet.</p>
      )}
      {pending > 0 && (
        <p className="mt-2 text-[11px] text-muted-foreground">
          {pending} more skill{pending === 1 ? "" : "s"} in this path, not assessed yet (starting at {profile.baseline}).
        </p>
      )}
    </section>
  );
}

export function LanguageToggle({ language }: { language: Language }) {
  return (
    <div role="group" aria-label="Content language" className="inline-flex items-center gap-1 rounded-full border border-border bg-card p-0.5">
      <Languages size={13} className="ms-2 text-muted-foreground" aria-hidden="true" />
      {(
        [
          ["ar", "العربية"],
          ["en", "English"],
        ] as const
      ).map(([value, label]) => (
        <button
          key={value}
          aria-pressed={language === value}
          onClick={() => setJourneyLanguage(value)}
          className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${language === value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent"}`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

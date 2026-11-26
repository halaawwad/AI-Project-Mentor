import { Link } from "@tanstack/react-router";
import { BarChart3, Download, Info, Lightbulb, TriangleAlert } from "lucide-react";
import { useState } from "react";
import { JourneyLayout } from "@/components/journey/JourneyUi";
import { Button } from "@/components/ui/button";
import { skillLabel } from "@/lib/journey/i18n";
import { aggregateInsights, anonymizedExport } from "@/lib/journey/insights";
import type { LearnerData } from "@/lib/journey/insights";
import { useJourney } from "@/lib/journey/store";
import { LEARNER_ID } from "@/lib/learner";
import type { Language } from "@/lib/journey/types";
import { useDocumentTitle } from "@/lib/useDocumentTitle";

/** Starts a browser download of a JSON file; nothing is sent anywhere. */
function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

const t = (language: Language, en: string, ar: string) => (language === "ar" ? ar : en);

/** Demo screen for the data flywheel: plain counts over the learner's data saved on this device. */
export function InsightsPage() {
  useDocumentTitle("Learning insights | AiPM");
  const journey = useJourney(); // re-render when the active learner's data changes
  const lang = journey.language;
  const dir = lang === "ar" ? "rtl" : "ltr";
  const data: LearnerData[] = [{ learner: LEARNER_ID, state: journey }];
  const stagesPassed = Object.values(journey.progress).filter((p) => p.passed).length;
  const insights = aggregateInsights(data, lang);
  const [exported, setExported] = useState(false);

  return (
    <JourneyLayout
      active="Learning Insights"
      eyebrow="LEARNING DATA"
      title="Learning insights"
      arabic="رؤى التعلّم"
      actions={
        <Button
          disabled={!insights.answers}
          onClick={() => {
            downloadJson(`aipm-learning-records-${new Date().toISOString().slice(0, 10)}.json`, anonymizedExport(data));
            setExported(true);
          }}
        >
          <Download size={15} /> Export anonymized JSON · تصدير JSON مجهول الهوية
        </Button>
      }
    >
      <section className="glass-panel rounded-[22px] border-s-4 border-warning p-4" aria-label="About this data">
        <p className="flex items-center gap-2 text-sm font-bold">
          <Info size={16} /> Local demo data — in the full platform this is aggregated across all students
        </p>
        <p dir="rtl" className="text-sm">
          بيانات تجريبية محلية — في المنصة الكاملة تُجمع هذه البيانات من جميع الطلاب
        </p>
        <p className="mt-1 text-[11px] text-muted-foreground">
          Plain counts over your answers and quiz attempts on this device, computed in the browser; no AI is used here. The
          export leaves out names, project titles and descriptions, and contains no API key.
          <span dir="rtl" className="block">
            عدّ بسيط لإجاباتك ومحاولاتك على هذا الجهاز داخل المتصفح، دون ذكاء اصطناعي. لا يتضمن التصدير الأسماء أو
            عناوين المشاريع أو أوصافها أو مفتاح API.
          </span>
        </p>
        {exported && (
          <p role="status" className="mt-1 text-[11px] font-semibold">
            Downloaded. · تم التنزيل.
          </p>
        )}
      </section>

      <section className="grid gap-3 sm:grid-cols-4" aria-label="Totals">
        {[
          [stagesPassed, "Stages passed", "مراحل مجتازة"],
          [insights.answers, "Answers recorded", "إجابات مسجلة"],
          [insights.wrongAnswers, "Wrong answers", "إجابات خاطئة"],
          [insights.attempts, "Quiz attempts", "محاولات اختبار"],
        ].map(([value, en, ar]) => (
          <div key={en} className="glass-panel rounded-[18px] p-4">
            <p className="font-mono text-2xl font-bold">{value}</p>
            <p className="text-xs text-muted-foreground">
              {en} <span dir="rtl">· {ar}</span>
            </p>
          </div>
        ))}
      </section>

      {!insights.answers ? (
        <section className="glass-panel rounded-[22px] p-6 text-sm">
          <p>No answers saved on this device yet. Take the level check and a few quizzes first.</p>
          <Button className="mt-3" asChild>
            <Link to="/journey">Go to the learning journey</Link>
          </Button>
        </section>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          <section className="glass-panel rounded-[22px] p-5" aria-label="Most common misconceptions">
            <h2 className="flex items-center gap-2 text-sm font-bold">
              <TriangleAlert size={15} /> Most common misconceptions <span dir="rtl" className="font-normal">· أكثر المفاهيم الخاطئة شيوعاً</span>
            </h2>
            <p className="text-[11px] text-muted-foreground">
              Wrong options mapped to the local knowledge base · خيارات خاطئة مطابقة لقاعدة المعرفة المحلية
            </p>
            {insights.misconceptions.length ? (
              <ol dir={dir} className="mt-2 space-y-2">
                {insights.misconceptions.map((m) => (
                  <li key={m.misconception.id} className="glass-inset rounded-lg p-3 text-sm">
                    <p className="font-semibold">{m.misconception.description[lang]}</p>
                    <p className="text-xs text-muted-foreground">✓ {m.misconception.correction[lang]}</p>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {skillLabel(m.misconception.skill, lang)} ·{" "}
                      {t(lang, `${m.count} wrong answers`, `${m.count} إجابات خاطئة`)}{" "}
                      · <code dir="ltr">{m.misconception.id}</code>
                    </p>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">No wrong answer matches a known misconception yet.</p>
            )}
          </section>

          <section className="glass-panel rounded-[22px] p-5" aria-label="Hardest questions">
            <h2 className="flex items-center gap-2 text-sm font-bold">
              <BarChart3 size={15} /> Hardest questions <span dir="rtl" className="font-normal">· أصعب الأسئلة</span>
            </h2>
            <p className="text-[11px] text-muted-foreground">Lowest correct rate · أقل نسبة إجابات صحيحة</p>
            {insights.hardestQuestions.length ? (
              <ol dir={dir} className="mt-2 space-y-2">
                {insights.hardestQuestions.map((q) => (
                  <li key={q.questionId} className="glass-inset rounded-lg p-3 text-sm">
                    <div className="flex items-start justify-between gap-2">
                      <p>{q.prompt}</p>
                      <span className="shrink-0 font-mono text-sm font-bold">{q.rate}%</span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={q.rate} aria-label={`${q.questionId} correct rate`}>
                      <div className="h-full rounded-full bg-destructive" style={{ width: `${Math.max(q.rate, 2)}%` }} />
                    </div>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {skillLabel(q.skill, lang)} · {t(lang, `${q.correct} of ${q.answered} correct`, `${q.correct} من ${q.answered} صحيحة`)}
                    </p>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">Every recorded question was answered correctly.</p>
            )}
          </section>

          <section className="glass-panel rounded-[22px] p-5 xl:col-span-2" aria-label="Explanations followed by a pass">
            <h2 className="flex items-center gap-2 text-sm font-bold">
              <Lightbulb size={15} /> Which alternative explanations were followed by a pass{" "}
              <span dir="rtl" className="font-normal">· أي الشروحات البديلة تلاها نجاح</span>
            </h2>
            <p className="text-[11px] text-muted-foreground">
              After a failed quiz, the retry starts with a re-explanation of the missed skill. Counted per stage and skill ·
              بعد اختبار لم يُجتز تبدأ الإعادة بشرح بديل للمهارة التي أُخطئ فيها.
            </p>
            {insights.explanations.length ? (
              <table dir={dir} className="mt-2 w-full text-sm">
                <thead className="text-start text-[11px] text-muted-foreground">
                  <tr>
                    <th className="py-1 text-start">{t(lang, "Stage", "المرحلة")}</th>
                    <th className="py-1 text-start">{t(lang, "Skill explained", "المهارة المشروحة")}</th>
                    <th className="py-1 text-start">{t(lang, "Explanation", "الشرح")}</th>
                    <th className="py-1 text-start">{t(lang, "Followed by a pass", "تلاه نجاح")}</th>
                  </tr>
                </thead>
                <tbody>
                  {insights.explanations.map((e) => (
                    <tr key={`${e.stageId}-${e.skill}-${e.source}`} className="border-t border-border">
                      <td className="py-1.5">{e.stageTitle}</td>
                      <td className="py-1.5">{skillLabel(e.skill, lang)}</td>
                      <td className="py-1.5">{e.source === "ai" ? t(lang, "Gemini explanation", "شرح Gemini") : t(lang, "Prewritten notes + analogy", "ملاحظات مكتوبة مسبقاً + تشبيه")}</td>
                      <td className="py-1.5 font-mono">
                        {e.passed} / {e.shown}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">
                No retries yet. Fail a stage quiz once, read the explanation, then retry.
              </p>
            )}
          </section>
        </div>
      )}
    </JourneyLayout>
  );
}

import { Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowRight, Gauge, Loader2 } from "lucide-react";
import { AiSourceLabel, FallbackReasonNote, StillWorking } from "@/components/AiLabel";
import { DemoBadge, JourneyLayout } from "@/components/journey/JourneyUi";
import { Button } from "@/components/ui/button";
import { runAiOnce } from "@/lib/ai/useAi";
import { difficultyLabel } from "@/lib/journey/adaptive";
import { questionDir, questionText } from "@/lib/journey/i18n";
import { levelInfo, levelQuestions, selfRatings } from "@/lib/journey/level";
import { assessLevel, levelCheckpoint, type LevelAssessment } from "@/lib/journey/levelAi";
import { setJourneyLevel, useJourney } from "@/lib/journey/store";
import { LEARNER_ID } from "@/lib/learner";
import { useDocumentTitle } from "@/lib/useDocumentTitle";

/** Self-rating plus three quick questions → beginner / intermediate / advanced. */
export function LevelPage() {
  useDocumentTitle("Level check | AiPM");
  const navigate = useNavigate();
  const journey = useJourney();
  const lang = journey.language;
  const learnerId = LEARNER_ID;
  const [rating, setRating] = useState<number | null>(null),
    [answers, setAnswers] = useState<(number | null)[]>(levelQuestions.map(() => null)),
    [result, setResult] = useState<LevelAssessment | null>(null),
    [assessing, setAssessing] = useState(false);
  // One Gemini request per "See my level" (cached per answers); the score thresholds are the fallback.
  const assess = async (force = false) => {
    if (rating === null || assessing) return;
    setAssessing(true);
    try {
      const run = () => assessLevel({ learnerId, rating, answers, language: lang });
      setResult(await runAiOnce(`level|${learnerId}|${levelCheckpoint(rating, answers)}|${lang}`, run, force));
    } finally {
      setAssessing(false);
    }
  };

  if (!journey.project || !journey.parts.length)
    return (
      <JourneyLayout step="parts" eyebrow="LEVEL CHECK" title="Choose your parts first" arabic="اختر القطع أولاً">
        <section className="glass-panel rounded-[22px] p-6 text-sm">
          <p>The level check comes after you have a parts list.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button asChild>
              <Link to="/describe">I have a project idea</Link>
            </Button>
            <Button variant="secondary" asChild>
              <Link to="/journey/choose">I don't have an idea yet</Link>
            </Button>
          </div>
        </section>
      </JourneyLayout>
    );

  const complete = rating !== null && answers.every((a) => a !== null);
  return (
    <JourneyLayout
      step="level"
      eyebrow={`LEVEL CHECK · ${journey.project.title.en.toUpperCase()}`}
      title="Quick level check"
      arabic="تحديد المستوى السريع"
      actions={<DemoBadge />}
    >
      <section className="glass-panel rounded-[22px] p-5" aria-labelledby="self-rating">
        <h2 id="self-rating" className="text-sm font-bold">
          1. How would you describe yourself? <span dir="rtl" className="font-normal">· كيف تصف نفسك؟</span>
        </h2>
        <div className="mt-3 grid gap-2 md:grid-cols-3" role="radiogroup" aria-labelledby="self-rating">
          {selfRatings.map((option) => (
            <label
              key={option.value}
              className={`glass-inset flex cursor-pointer items-start gap-2 rounded-xl p-3 text-sm ${rating === option.value ? "ring-2 ring-primary" : ""}`}
            >
              <input
                type="radio"
                name="self-rating"
                checked={rating === option.value}
                onChange={() => {
                  setRating(option.value);
                  setResult(null);
                }}
                className="mt-1"
              />
              <span>
                {option.label.en}
                <span dir="rtl" className="block text-xs text-muted-foreground">
                  {option.label.ar}
                </span>
              </span>
            </label>
          ))}
        </div>
      </section>

      <section className="glass-panel space-y-4 rounded-[22px] p-5" aria-label="Quick questions">
        {levelQuestions.map((question, qi) => (
          <fieldset key={question.id} dir={questionDir(question, lang)}>
            <legend className="text-sm font-bold">
              {qi + 2}. {questionText(question, lang).prompt}
            </legend>
            <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
              {questionText(question, lang).options.map((option, oi) => (
                <label
                  key={oi}
                  className={`glass-inset flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm ${answers[qi] === oi ? "ring-2 ring-primary" : ""}`}
                >
                  <input
                    type="radio"
                    name={question.id}
                    checked={answers[qi] === oi}
                    onChange={() => {
                      setAnswers((current) => current.map((a, i) => (i === qi ? oi : a)));
                      setResult(null);
                    }}
                  />
                  {option}
                </label>
              ))}
            </div>
          </fieldset>
        ))}
        <Button disabled={!complete || assessing} onClick={() => void assess()}>
          {assessing ? <Loader2 size={15} className="animate-spin" /> : <Gauge size={15} />}{" "}
          {assessing ? "Assessing your level… · جارٍ تحديد مستواك…" : "See my level"}
        </Button>{" "}
        <StillWorking active={assessing} />
      </section>

      {result && (
        <section role="status" className="glass-panel rounded-[22px] p-5">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs text-muted-foreground">
              {result.correct} of {levelQuestions.length} answers correct · level score {result.score} / 5
            </p>
            <AiSourceLabel source={result.source} local="rules" />
          </div>
          <h2 className="mt-1 text-xl font-bold">
            Your level: {levelInfo[result.level].title.en}{" "}
            <span dir="rtl" className="font-normal">
              · {levelInfo[result.level].title.ar}
            </span>
          </h2>
          <p className="text-xs text-muted-foreground">
            Starting difficulty: {difficultyLabel(result.difficulty).en} · {difficultyLabel(result.difficulty).ar}
          </p>
          <p dir={lang === "ar" ? "rtl" : "ltr"} className="mt-2 text-sm">
            {result.reason}
          </p>
          {result.source === "ai" && (
            <p dir={lang === "ar" ? "rtl" : "ltr"} className="mt-1 text-xs text-muted-foreground">
              {levelInfo[result.level].path[lang]}
            </p>
          )}
          <FallbackReasonNote reason={result.fallbackReason} onRetry={() => assess(true)} />
          <Button
            className="mt-4"
            onClick={() => {
              setJourneyLevel(result.level, result.score, answers, result.difficulty);
              void navigate({ to: "/journey" });
            }}
          >
            Start my learning path <ArrowRight size={14} />
          </Button>
        </section>
      )}
    </JourneyLayout>
  );
}

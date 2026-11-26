import { Link, useSearch } from "@tanstack/react-router";
import { useRef, useState } from "react";
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ClipboardCheck,
  Lightbulb,
  Loader2,
  Wrench,
  Lock,
  RotateCcw,
  Sparkles,
  Target,
  ThumbsUp,
  Trophy,
  XCircle,
} from "lucide-react";
import { DemoBadge, JourneyLayout } from "@/components/journey/JourneyUi";
import { PartLinks } from "@/components/journey/PartLinks";
import { ActionBadge, MentorAnalysisPanel, RemedialCard, WhatChanged } from "@/components/journey/Mentor";
import { PersonalSourceLabel, WhyThisQuizCard } from "@/components/journey/Personalization";
import { effectivePlan, latestInsight, planForStage } from "@/lib/journey/mentor";
import { AiSourceLabel, FallbackReasonNote, StillWorking } from "@/components/AiLabel";
import { useAiResult } from "@/lib/ai/useAi";
import { prepareFeedback, type FeedbackContext } from "@/lib/journey/feedbackAi";
import { cachedLesson, lessonContext, localLesson, prepareLesson, type LessonText } from "@/lib/journey/lessonAi";
import { useMentorInsight } from "@/lib/journey/useMentor";
import { Button } from "@/components/ui/button";
import { usePartPreviews } from "@/lib/lab/usePartPreviews";
import { gradeQuiz, mentorFeedback, stageStatuses, type QuizGrade } from "@/lib/journey/grading";
import { buildPath } from "@/lib/journey/path";
import { cachedQuiz, preparePersonalizedQuiz } from "@/lib/journey/personalize";
import { readJourney, recordQuizResult, savePendingQuiz, useJourney } from "@/lib/journey/store";
import { LEARNER_ID } from "@/lib/learner";
import { difficultyLabel, initialProfile } from "@/lib/journey/adaptive";
import { questionDir, questionText, skillLabel } from "@/lib/journey/i18n";
import { PASS_MARK, type Language, type PersonalizedQuiz, type Question, type Stage } from "@/lib/journey/types";
import { useDocumentTitle } from "@/lib/useDocumentTitle";

type Phase = "learn" | "preparing" | "brief" | "quiz" | "result";

/** One learning stage: explanation and parts, then a personalized, gated quiz. */
export function StagePage() {
  const { id } = useSearch({ from: "/journey/stage" });
  const journey = useJourney();
  const stages = buildPath(journey);
  const index = stages.findIndex((stage) => stage.id === id);
  const stage = stages[index];
  useDocumentTitle(`${stage?.title.en ?? "Stage"} | AiPM`);
  const statuses = stageStatuses(stages, journey.progress);

  if (!stage)
    return (
      <JourneyLayout step="path" eyebrow="LEARNING PATH" title="Stage not found" arabic="المرحلة غير موجودة">
        <section className="glass-panel rounded-[22px] p-6 text-sm">
          <p>This stage isn't part of this learner's current learning path.</p>
          <Button className="mt-3" asChild>
            <Link to="/journey">Back to the learning path</Link>
          </Button>
        </section>
      </JourneyLayout>
    );

  if (statuses[index] === "locked")
    return (
      <JourneyLayout step="path" eyebrow={`STAGE ${index + 1}`} title={stage.title.en} arabic={stage.title.ar}>
        <section className="glass-panel rounded-[22px] p-6 text-sm">
          <p className="flex items-center gap-2 font-semibold">
            <Lock size={16} /> Locked · مقفلة
          </p>
          <p className="mt-2">Pass the previous stage's quiz ({PASS_MARK}% or more) to unlock this stage.</p>
          <Button className="mt-3" asChild>
            <Link to="/journey">Back to the learning path</Link>
          </Button>
        </section>
      </JourneyLayout>
    );

  // Remount per stage so one stage's quiz state never carries over to another.
  return <StageContent key={stage.id} stage={stage} index={index} stages={stages} />;
}

function StageContent({ stage, index, stages }: { stage: Stage; index: number; stages: Stage[] }) {
  const journey = useJourney();
  const previews = usePartPreviews();
  const progress = journey.progress[stage.id];
  const cached = cachedQuiz(journey, stage.id);
  // A cached quiz (e.g. after a reload) is shown again without another request.
  const [phase, setPhase] = useState<Phase>(cached ? "brief" : "learn");
  const [quiz, setQuiz] = useState<PersonalizedQuiz | null>(cached);
  const [answers, setAnswers] = useState<(number | null)[]>([]);
  const [grade, setGrade] = useState<QuizGrade | null>(null);
  const [fullLesson, setFullLesson] = useState(false);
  const inFlight = useRef(false);
  const next = stages[index + 1];

  const prepare = async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setPhase("preparing");
    try {
      const prepared = await preparePersonalizedQuiz({ state: readJourney(), stages, index, learnerId: LEARNER_ID });
      savePendingQuiz(prepared);
      setQuiz(prepared);
      setGrade(null);
      setPhase("brief");
    } finally {
      inFlight.current = false;
    }
  };
  const startQuiz = () => {
    if (!quiz) return;
    setAnswers(quiz.questions.map(() => null));
    setPhase("quiz");
    requestAnimationFrame(() => document.getElementById("stage-quiz")?.scrollIntoView({ block: "start" }));
  };
  const submit = () => {
    if (!quiz) return;
    const result = gradeQuiz(quiz, answers);
    recordQuizResult(stage.id, quiz, answers, result);
    setGrade(result);
    setPhase("result");
    requestAnimationFrame(() => document.getElementById("stage-result")?.scrollIntoView({ block: "start" }));
  };
  const lang = journey.language;
  const learnerId = LEARNER_ID;
  // AI-written lesson for this learner (cached per stage, level and language).
  const lessonCtx = lessonContext(journey, stage);
  const aiLesson = useAiResult(
    `lesson|${learnerId}|${stage.id}|${journey.level}|${lang}`,
    () => prepareLesson({ learnerId, ctx: lessonCtx }),
    () => cachedLesson(learnerId, lessonCtx),
  );
  const lesson: LessonText = aiLesson.value ?? localLesson(stage, lang);
  const lessonDir = lang === "ar" ? "rtl" : "ltr";
  // The personalized plan only changes how the lesson is shown; the quiz and gating stay the same.
  const shownInsight = latestInsight(journey);
  const { item: planItem, remedials } = planForStage(effectivePlan(stages, shownInsight), stage.id);
  const planDir = shownInsight?.language === "ar" ? "rtl" : "ltr";
  const adapted = !progress?.passed && (planItem?.action === "shorten" || planItem?.action === "skippable");
  // Local questions carry both languages; Gemini questions are in the quiz's own language.
  const shown = (question: Question) => questionText(question, lang);

  return (
    <JourneyLayout
      step={phase === "learn" ? "path" : "quizzes"}
      eyebrow={`STAGE ${index + 1} OF ${stages.length} · ${journey.project?.title.en.toUpperCase() ?? ""}`}
      title={stage.title.en}
      arabic={stage.title.ar}
      actions={<DemoBadge generated={stage.source === "generated"} />}
    >
      {!progress?.passed && !!remedials.length && (
        <section className="glass-panel space-y-2 rounded-[22px] p-5" aria-label="Mini-lessons before this stage">
          <h2 className="text-sm font-bold">
            Before this stage <span dir="rtl" className="font-normal">· قبل هذه المرحلة</span>
          </h2>
          {remedials.map((item) => (
            <RemedialCard key={item.target} item={item} stages={stages} language={shownInsight?.language ?? lang} />
          ))}
        </section>
      )}
      <section className="glass-panel rounded-[22px] p-5" aria-label="Lesson">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          {aiLesson.value ? (
            <AiSourceLabel source={aiLesson.value.source} />
          ) : (
            <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground" aria-busy="true">
              <Loader2 size={12} className="animate-spin" /> Writing a lesson for you… · جارٍ كتابة درس لك…{" "}
              <StillWorking active />
            </span>
          )}
        </div>
        {aiLesson.value && <FallbackReasonNote reason={aiLesson.value.fallbackReason} onRetry={aiLesson.retry} />}
        {aiLesson.value?.source === "ai" && !!aiLesson.value.localFields?.length && (
          <p className="mb-2 text-[11px] text-muted-foreground">
            From local content instead:{" "}
            {aiLesson.value.localFields.map((f) => lessonFieldNames[f].en).join(", ")}{" "}
            <span dir="rtl">· من المحتوى المحلي: {aiLesson.value.localFields.map((f) => lessonFieldNames[f].ar).join("، ")}</span>
          </p>
        )}
        <h2 className="flex items-center gap-2 text-sm font-bold">
          <Target size={16} /> Goal <span dir="rtl" className="font-normal">· الهدف</span>
        </h2>
        <p dir={lessonDir} className="mt-1 text-sm">
          {lesson.goal}
        </p>
        <h2 className="mt-4 flex flex-wrap items-center gap-2 text-sm font-bold">
          <BookOpen size={16} /> Explanation <span dir="rtl" className="font-normal">· الشرح</span>
          {adapted && planItem && <ActionBadge action={planItem.action} />}
        </h2>
        {adapted && planItem && (
          <p dir={planDir} className="mt-1 text-xs text-muted-foreground">
            {planItem.reason}{" "}
            {planItem.action === "skippable" &&
              (lang === "ar"
                ? `يمكنك تخطي الدرس، لكن عليك اجتياز الاختبار بنسبة ${PASS_MARK}% لفتح المرحلة التالية.`
                : `You can skip the lesson, but you still need ${PASS_MARK}% on the quiz to unlock the next stage.`)}
          </p>
        )}
        {(!adapted || fullLesson || planItem?.action === "shorten") && (
          <p dir={lessonDir} className="mt-1 max-w-4xl text-sm leading-7">
            {adapted && !fullLesson ? shortLesson(lesson.explanation) : lesson.explanation}
          </p>
        )}
        {adapted && (
          <Button size="sm" variant="ghost" className="mt-1" aria-expanded={fullLesson} onClick={() => setFullLesson(!fullLesson)}>
            {fullLesson ? "Show less · عرض أقل" : "Show the full lesson · اعرض الدرس كاملاً"}
          </Button>
        )}
        <h2 className="mt-4 flex items-center gap-2 text-sm font-bold">
          <Lightbulb size={16} /> Analogy <span dir="rtl" className="font-normal">· تشبيه</span>
        </h2>
        <p dir={lessonDir} className="mt-1 max-w-4xl text-sm leading-7">
          {lesson.analogy}
        </p>
        <h2 className="mt-4 flex items-center gap-2 text-sm font-bold">
          <Wrench size={16} /> Practice task <span dir="rtl" className="font-normal">· تمرين عملي</span>
        </h2>
        <p dir={lessonDir} className="mt-1 max-w-4xl text-sm">
          {lesson.practiceTask}
        </p>
        {journey.level === "advanced" && !progress?.passed && (
          <p className="mt-2 text-[11px] text-muted-foreground">Advanced level: you can go straight to the quiz.</p>
        )}
        <h2 className="mt-4 text-sm font-bold">
          Parts in this stage <span dir="rtl" className="font-normal">· قطع هذه المرحلة</span>
        </h2>
        <ul className="mt-2 space-y-1.5">
          {stage.parts.map((key) => (
            <PartLinks key={key} partKey={key} previews={previews} />
          ))}
        </ul>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {phase === "learn" && (
            <Button onClick={() => void prepare()}>
              <ClipboardCheck size={15} /> {progress?.passed ? "Prepare a practice quiz" : "Prepare my quiz"}
            </Button>
          )}
          {phase === "preparing" && (
            <Button disabled aria-busy="true">
              <Loader2 className="animate-spin" /> Preparing a quiz for you… · جارٍ تجهيز اختبارك…
            </Button>
          )}
          {phase === "preparing" && (
            <StillWorking active />
          )}
          <span className="text-xs text-muted-foreground">
            {progress
              ? `Best ${progress.bestScore}% · ${progress.attempts} attempt${progress.attempts === 1 ? "" : "s"}${progress.passed ? " · passed" : ""}`
              : `Pass mark ${PASS_MARK}%`}
          </span>
        </div>
      </section>

      {quiz && phase === "brief" && (
        <>
          <WhyThisQuizCard quiz={quiz} />
          <Button onClick={startQuiz}>
            <ClipboardCheck size={15} /> Start the quiz · ابدأ الاختبار
          </Button>
        </>
      )}

      {quiz && phase === "quiz" && (
        <section id="stage-quiz" className="glass-panel space-y-4 rounded-[22px] p-5" aria-label="Stage quiz">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-bold">
              Your quiz · {quiz.questions.length} questions <span dir="rtl" className="font-normal">· اختبارك</span>
            </h2>
            <PersonalSourceLabel quiz={quiz} />
          </div>
          {quiz.questions.map((question, qi) => (
            <fieldset key={question.id} dir={questionDir(question, lang)}>
              <legend className="text-sm font-semibold">
                {qi + 1}. {shown(question).prompt}{" "}
                <span className="text-[10px] font-normal text-muted-foreground">
                  [{skillLabel(question.skill, lang)} · {difficultyLabel(question.difficulty)[lang]}]
                </span>
              </legend>
              <div className="mt-2 grid gap-1.5 md:grid-cols-2">
                {shown(question).options.map((option, oi) => (
                  <label
                    key={oi}
                    className={`glass-inset flex cursor-pointer items-start gap-2 rounded-lg px-3 py-2 text-sm ${answers[qi] === oi ? "ring-2 ring-primary" : ""}`}
                  >
                    <input
                      type="radio"
                      name={question.id}
                      checked={answers[qi] === oi}
                      onChange={() => setAnswers((current) => current.map((a, i) => (i === qi ? oi : a)))}
                      className="mt-1"
                    />
                    {option}
                  </label>
                ))}
              </div>
            </fieldset>
          ))}
          <div className="flex flex-wrap items-center gap-2">
            <Button disabled={answers.some((a) => a === null)} onClick={submit}>
              Submit answers
            </Button>
            <Button variant="ghost" onClick={() => setPhase("brief")}>
              Back
            </Button>
          </div>
        </section>
      )}

      {quiz && grade && phase === "result" && (
        <section id="stage-result" className="space-y-4" aria-label="Quiz result">
          <div role="status" className="glass-panel rounded-[22px] p-5">
            <p className="flex items-center gap-2 text-lg font-bold">
              {grade.passed ? <CheckCircle2 className="text-success" /> : <XCircle className="text-destructive" />}
              {grade.score}% · {grade.correct} of {grade.total} correct ·{" "}
              {grade.passed ? "Stage passed" : `Not yet — ${PASS_MARK}% needed`}
            </p>
            <p dir="rtl" className="text-xs text-muted-foreground">
              {grade.passed ? "اجتزت المرحلة" : `لم تجتز بعد — المطلوب ${PASS_MARK}%`}
            </p>
            <ol className="mt-3 space-y-2">
              {quiz.questions.map((question, qi) => (
                <li key={question.id} dir={questionDir(question, lang)} className="glass-inset rounded-lg p-3 text-sm">
                  <p className="font-semibold">
                    {grade.results[qi] ? "✓" : "✗"} {shown(question).prompt}
                  </p>
                  {!grade.results[qi] && (
                    <p className="text-xs">
                      {answers[qi] !== null && <>✗ {shown(question).options[answers[qi] ?? -1]} · </>}✓{" "}
                      <strong>{shown(question).options[question.correct]}</strong>
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">{shown(question).explanation}</p>
                </li>
              ))}
            </ol>
            {grade.passed && (
              <div className="mt-4 flex flex-wrap gap-2">
                {next ? (
                  <Button asChild>
                    <Link to="/journey/stage" search={{ id: next.id }}>
                      Next stage: {next.title.en} <ArrowRight size={14} />
                    </Link>
                  </Button>
                ) : (
                  <Button asChild>
                    <Link to="/journey/ready">
                      <Trophy size={15} /> Ready to build your project
                    </Link>
                  </Button>
                )}
                <Button variant="ghost" asChild>
                  <Link to="/journey">Learning path</Link>
                </Button>
              </div>
            )}
          </div>
          {grade.passed ? (
            <StageMentor stages={stages} language={lang} />
          ) : (
            <MentorPanel stage={stage} quiz={quiz} answers={answers} grade={grade} language={lang} onNext={() => void prepare()} />
          )}
        </section>
      )}
    </JourneyLayout>
  );
}

const lessonFieldNames: Record<keyof LessonText, { en: string; ar: string }> = {
  goal: { en: "goal", ar: "الهدف" },
  explanation: { en: "explanation", ar: "الشرح" },
  analogy: { en: "analogy", ar: "التشبيه" },
  practiceTask: { en: "practice task", ar: "التمرين العملي" },
};

/** First sentences of a lesson, for a stage the plan shortened. */
function shortLesson(text: string) {
  const sentences = text.split(/(?<=[.!?؟])\s+/);
  return sentences.length > 2 ? `${sentences.slice(0, 2).join(" ")} …` : text;
}

/** After a completed stage: the updated analysis and plan (one Gemini request per completed stage). */
function StageMentor({ stages, language }: { stages: Stage[]; language: Language }) {
  const mentor = useMentorInsight(stages);
  return (
    <>
      <MentorAnalysisPanel mentor={mentor} language={language} />
      <WhatChanged mentor={mentor} stages={stages} />
      <Button variant="secondary" asChild>
        <Link to="/journey">See your updated plan · اعرض خطتك المحدّثة</Link>
      </Button>
    </>
  );
}

function MentorPanel({
  stage,
  quiz,
  answers,
  grade,
  language,
  onNext,
}: {
  stage: Stage;
  quiz: PersonalizedQuiz;
  answers: (number | null)[];
  grade: QuizGrade;
  language: Language;
  onNext: () => void;
}) {
  const journey = useJourney();
  const learnerId = LEARNER_ID;
  const feedback = mentorFeedback(stage, quiz, grade);
  const dir = language === "ar" ? "rtl" : "ltr";
  // One Gemini request per failed attempt: the misconception behind each wrong answer.
  const ctx: FeedbackContext = {
    stage,
    quiz,
    answers,
    profile: journey.profile ?? initialProfile(journey.level ?? "intermediate"),
    language,
    projectParts: journey.parts.map((p) => p.key),
  };
  const ai = useAiResult(`feedback|${learnerId}|${stage.id}|${quiz.id}|${answers.join(",")}|${language}`, () =>
    prepareFeedback({ learnerId, ctx }),
  );
  const notes = ai.value;
  return (
    <div className="glass-panel rounded-[22px] p-5" aria-label="Mentor feedback">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="flex items-center gap-2 text-base font-bold">
          <Sparkles size={17} /> Mentor feedback <span dir="rtl" className="font-normal">· ملاحظات المرشد</span>
        </h2>
        {notes ? (
          <AiSourceLabel source={notes.source} local="rules" />
        ) : (
          <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground" aria-busy="true">
            <Loader2 size={12} className="animate-spin" /> Looking at your answers… · جارٍ النظر في إجاباتك…{" "}
            <StillWorking active />
          </span>
        )}
      </div>
      {notes && (
        <div className="mt-3 space-y-2">
          <h3 className="text-sm font-semibold">
            What went wrong <span dir="rtl" className="font-normal">· ما الذي حدث</span>
          </h3>
          <ul className="space-y-1.5">
            {notes.mistakes.map((m) => {
              const q = quiz.questions[m.index]!;
              return (
                <li key={m.index} dir={dir} className="glass-inset rounded-lg p-2.5 text-sm">
                  <p className="text-[11px] text-muted-foreground">{questionText(q, language).prompt}</p>
                  <p>{m.misconception}</p>
                </li>
              );
            })}
          </ul>
          <p dir={dir} className="text-sm leading-7">
            {notes.explanation}
          </p>
          <p dir={dir} className="flex items-start gap-1.5 text-sm">
            <Wrench size={14} className="mt-1 shrink-0" /> {notes.practiceTask}
          </p>
          <FallbackReasonNote reason={notes.fallbackReason} onRetry={ai.retry} />
        </div>
      )}
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <div className="glass-inset rounded-xl p-3">
          <h3 className="flex items-center gap-1.5 text-sm font-semibold">
            <ThumbsUp size={14} /> Strengths <span dir="rtl" className="font-normal">· نقاط القوة</span>
          </h3>
          {feedback.strengths.length ? (
            <ul dir={dir} className="mt-1 list-disc ps-5 text-sm">
              {feedback.strengths.map((skill) => (
                <li key={skill}>{skillLabel(skill, language)}</li>
              ))}
            </ul>
          ) : (
            <p dir={dir} className="mt-1 text-sm text-muted-foreground">
              {language === "ar"
                ? "لم تُتقن أي مهارة بالكامل بعد، وهذا ما سيساعدك عليه الاختبار التالي."
                : "No skill fully secured yet — that's what the next quiz is for."}
            </p>
          )}
        </div>
        <div className="glass-inset rounded-xl p-3">
          <h3 className="flex items-center gap-1.5 text-sm font-semibold">
            <Target size={14} /> Weak points <span dir="rtl" className="font-normal">· نقاط تحتاج تحسيناً</span>
          </h3>
          <ul dir={dir} className="mt-1 list-disc ps-5 text-sm">
            {feedback.weakPoints.map((skill) => (
              <li key={skill}>{skillLabel(skill, language)}</li>
            ))}
          </ul>
        </div>
      </div>
      <p className="mt-3 text-sm">
        Your next quiz will focus on your weak points, with an explanation and a practice task first.
        <span dir="rtl" className="block text-xs text-muted-foreground">
          سيركّز اختبارك التالي على نقاط ضعفك، مع شرح وتمرين عملي قبله.
        </span>
      </p>
      <Button className="mt-3" onClick={onNext}>
        <RotateCcw size={14} /> Prepare my next quiz · جهّز اختباري التالي
      </Button>
    </div>
  );
}

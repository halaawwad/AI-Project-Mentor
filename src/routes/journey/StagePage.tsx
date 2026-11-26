import { Link, useSearch } from "@tanstack/react-router";
import { useRef, useState } from "react";
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ClipboardCheck,
  Loader2,
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
import { PersonalSourceLabel, WhyThisQuizCard } from "@/components/journey/Personalization";
import { Button } from "@/components/ui/button";
import { usePartPreviews } from "@/lib/lab/usePartPreviews";
import { gradeQuiz, mentorFeedback, stageStatuses, type QuizGrade } from "@/lib/journey/grading";
import { buildPath } from "@/lib/journey/path";
import { cachedQuiz, preparePersonalizedQuiz } from "@/lib/journey/personalize";
import {
  activeLearner,
  readJourney,
  recordQuizResult,
  savePendingQuiz,
  useActiveLearner,
  useJourney,
} from "@/lib/journey/store";
import { difficultyLabel } from "@/lib/journey/adaptive";
import { questionDir, questionText, skillLabel, stageText } from "@/lib/journey/i18n";
import { PASS_MARK, type Language, type PersonalizedQuiz, type Question, type Stage } from "@/lib/journey/types";
import { useDocumentTitle } from "@/lib/useDocumentTitle";

type Phase = "learn" | "preparing" | "brief" | "quiz" | "result";

/** One learning stage: explanation and parts, then a personalized, gated quiz. */
export function StagePage() {
  const { id } = useSearch({ from: "/journey/stage" });
  const journey = useJourney();
  const learner = useActiveLearner();
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

  // Remount per learner and stage so a learner switch never shows another learner's quiz.
  return <StageContent key={`${learner}-${stage.id}`} stage={stage} index={index} stages={stages} />;
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
  const inFlight = useRef(false);
  const next = stages[index + 1];

  const prepare = async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setPhase("preparing");
    const learner = activeLearner();
    try {
      const prepared = await preparePersonalizedQuiz({ state: readJourney(), stages, index, learnerId: learner });
      // Ignore the result if the learner was switched while it was being prepared.
      if (activeLearner() !== learner) return;
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
  const lesson = stageText(stage, lang);
  const lessonDir = lang === "ar" ? "rtl" : "ltr";
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
      <section className="glass-panel rounded-[22px] p-5" aria-label="Lesson">
        <h2 className="flex items-center gap-2 text-sm font-bold">
          <Target size={16} /> Goal <span dir="rtl" className="font-normal">· الهدف</span>
        </h2>
        <p dir={lessonDir} className="mt-1 text-sm">
          {lesson.goal}
        </p>
        <h2 className="mt-4 flex items-center gap-2 text-sm font-bold">
          <BookOpen size={16} /> Explanation <span dir="rtl" className="font-normal">· الشرح</span>
        </h2>
        <p dir={lessonDir} className="mt-1 max-w-4xl text-sm leading-7">
          {lesson.explanation}
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
          {!grade.passed && (
            <MentorPanel stage={stage} quiz={quiz} grade={grade} language={lang} onNext={() => void prepare()} />
          )}
        </section>
      )}
    </JourneyLayout>
  );
}

function MentorPanel({
  stage,
  quiz,
  grade,
  language,
  onNext,
}: {
  stage: Stage;
  quiz: PersonalizedQuiz;
  grade: QuizGrade;
  language: Language;
  onNext: () => void;
}) {
  const feedback = mentorFeedback(stage, quiz, grade);
  const dir = language === "ar" ? "rtl" : "ltr";
  return (
    <div className="glass-panel rounded-[22px] p-5" aria-label="Mentor feedback">
      <h2 className="flex items-center gap-2 text-base font-bold">
        <Sparkles size={17} /> Mentor feedback <span dir="rtl" className="font-normal">· ملاحظات المرشد</span>
      </h2>
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

import { Link, useSearch } from "@tanstack/react-router";
import { useState } from "react";
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ClipboardCheck,
  Lightbulb,
  Lock,
  RotateCcw,
  Sparkles,
  Target,
  ThumbsUp,
  Trophy,
  Wrench,
  XCircle,
} from "lucide-react";
import { DemoBadge, JourneyLayout } from "@/components/journey/JourneyUi";
import { PartLinks } from "@/components/journey/PartLinks";
import { Button } from "@/components/ui/button";
import { usePartPreviews } from "@/lib/lab/usePartPreviews";
import {
  gradeQuiz,
  mentorFeedback,
  quizFor,
  recordAttempt,
  stageStatuses,
  type QuizGrade,
} from "@/lib/journey/grading";
import { buildPath } from "@/lib/journey/path";
import { updateJourney, useJourney } from "@/lib/journey/store";
import { PASS_MARK, type Quiz, type Stage } from "@/lib/journey/types";
import { useDocumentTitle } from "@/lib/useDocumentTitle";

type Phase = "learn" | "quiz" | "result";

/** One learning stage: explanation and parts, then a gated quiz with mentor feedback. */
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
          <p>This stage isn't part of your current learning path.</p>
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

  return <StageContent key={stage.id} stage={stage} index={index} stages={stages} />;
}

function StageContent({ stage, index, stages }: { stage: Stage; index: number; stages: Stage[] }) {
  const journey = useJourney();
  const previews = usePartPreviews();
  const progress = journey.progress[stage.id];
  const [phase, setPhase] = useState<Phase>("learn");
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [answers, setAnswers] = useState<(number | null)[]>([]);
  const [grade, setGrade] = useState<QuizGrade | null>(null);
  const next = stages[index + 1];

  const startQuiz = () => {
    const chosen = quizFor(stage, journey.progress[stage.id]);
    setQuiz(chosen);
    setAnswers(chosen.questions.map(() => null));
    setGrade(null);
    setPhase("quiz");
    requestAnimationFrame(() => document.getElementById("stage-quiz")?.scrollIntoView({ block: "start" }));
  };
  const submit = () => {
    if (!quiz) return;
    const result = gradeQuiz(quiz, answers);
    updateJourney((state) => ({ ...state, progress: recordAttempt(state.progress, stage.id, result) }));
    setGrade(result);
    setPhase("result");
    requestAnimationFrame(() => document.getElementById("stage-result")?.scrollIntoView({ block: "start" }));
  };

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
        <p className="mt-1 text-sm">{stage.goal}</p>
        <h2 className="mt-4 flex items-center gap-2 text-sm font-bold">
          <BookOpen size={16} /> Explanation <span dir="rtl" className="font-normal">· الشرح</span>
        </h2>
        <p className="mt-1 max-w-4xl text-sm leading-7">{stage.explanation}</p>
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
            <Button onClick={startQuiz}>
              <ClipboardCheck size={15} /> {progress?.passed ? "Retake the quiz" : "Take the stage quiz"}
            </Button>
          )}
          <span className="text-xs text-muted-foreground">
            {progress
              ? `Best ${progress.bestScore}% · ${progress.attempts} attempt${progress.attempts === 1 ? "" : "s"}${progress.passed ? " · passed" : ""}`
              : `Pass mark ${PASS_MARK}%`}
          </span>
        </div>
      </section>

      {quiz && phase === "quiz" && (
        <section id="stage-quiz" className="glass-panel space-y-4 rounded-[22px] p-5" aria-label="Stage quiz">
          <h2 className="text-sm font-bold">
            Stage quiz · version {quiz.id.endsWith("-b") ? "B" : "A"}{" "}
            <span dir="rtl" className="font-normal">· اختبار المرحلة</span>
          </h2>
          {quiz.questions.map((question, qi) => (
            <fieldset key={question.id}>
              <legend className="text-sm font-semibold">
                {qi + 1}. {question.prompt}
              </legend>
              <div className="mt-2 grid gap-1.5 md:grid-cols-2">
                {question.options.map((option, oi) => (
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
            <Button variant="ghost" onClick={() => setPhase("learn")}>
              Back to the lesson
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
                <li key={question.id} className="glass-inset rounded-lg p-3 text-sm">
                  <p className="font-semibold">
                    {grade.results[qi] ? "✓" : "✗"} {question.prompt}
                  </p>
                  {!grade.results[qi] && (
                    <p className="text-xs">
                      Your answer: {question.options[answers[qi] ?? -1] ?? "—"} · Correct:{" "}
                      <strong>{question.options[question.correct]}</strong>
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">{question.explanation}</p>
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
          {!grade.passed && <MentorPanel stage={stage} quiz={quiz} grade={grade} onRetry={startQuiz} />}
        </section>
      )}
    </JourneyLayout>
  );
}

function MentorPanel({ stage, quiz, grade, onRetry }: { stage: Stage; quiz: Quiz; grade: QuizGrade; onRetry: () => void }) {
  const feedback = mentorFeedback(stage, quiz, grade);
  return (
    <div className="glass-panel rounded-[22px] p-5" aria-label="Mentor feedback">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="flex items-center gap-2 text-base font-bold">
          <Sparkles size={17} /> Mentor feedback <span dir="rtl" className="font-normal">· ملاحظات المرشد</span>
        </h2>
        <DemoBadge generated={stage.source === "generated"} />
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <div className="glass-inset rounded-xl p-3">
          <h3 className="flex items-center gap-1.5 text-sm font-semibold">
            <ThumbsUp size={14} /> Strengths <span dir="rtl" className="font-normal">· نقاط القوة</span>
          </h3>
          {feedback.strengths.length ? (
            <ul className="mt-1 list-disc ps-5 text-sm">
              {feedback.strengths.map((skill) => (
                <li key={skill}>{skill}</li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 text-sm text-muted-foreground">No skill fully secured yet — that's what the next try is for.</p>
          )}
        </div>
        <div className="glass-inset rounded-xl p-3">
          <h3 className="flex items-center gap-1.5 text-sm font-semibold">
            <Target size={14} /> Weak points <span dir="rtl" className="font-normal">· نقاط تحتاج تحسيناً</span>
          </h3>
          <ul className="mt-1 list-disc ps-5 text-sm">
            {feedback.weakPoints.map((skill) => (
              <li key={skill}>{skill}</li>
            ))}
          </ul>
        </div>
      </div>
      <h3 className="mt-4 flex items-center gap-1.5 text-sm font-semibold">
        <Lightbulb size={14} /> Another way to see it <span dir="rtl" className="font-normal">· شرح بطريقة أخرى</span>
      </h3>
      <p className="mt-1 text-sm leading-7">{feedback.alternative}</p>
      <h3 className="mt-4 flex items-center gap-1.5 text-sm font-semibold">
        <Wrench size={14} /> Practice task <span dir="rtl" className="font-normal">· تمرين عملي</span>
      </h3>
      <p className="mt-1 text-sm">{feedback.practiceTask}</p>
      <Button className="mt-4" onClick={onRetry}>
        <RotateCcw size={14} /> Take the new quiz
      </Button>
      <p className="mt-1 text-[11px] text-muted-foreground">The next attempt uses a different version of the quiz.</p>
    </div>
  );
}

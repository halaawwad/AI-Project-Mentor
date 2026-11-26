import { PASS_MARK, type Quiz, type Stage, type StageProgress } from "./types";

export interface QuizGrade {
  correct: number;
  total: number;
  /** Percentage, rounded. */
  score: number;
  passed: boolean;
  /** Per question: whether the chosen answer was correct. */
  results: boolean[];
}

/** Grades locally. Unanswered questions count as wrong. Pass mark is 80%. */
export function gradeQuiz(quiz: Quiz, answers: (number | null | undefined)[]): QuizGrade {
  const results = quiz.questions.map((q, i) => answers[i] === q.correct);
  const correct = results.filter(Boolean).length;
  const total = quiz.questions.length;
  const score = total ? Math.round((correct / total) * 100) : 0;
  return { correct, total, score, passed: score >= PASS_MARK, results };
}

export type StageStatus = "passed" | "current" | "locked";

/** Stages before the first unpassed one are passed; that one is current; the rest are locked. */
export function stageStatuses(stages: Stage[], progress: Record<string, StageProgress>): StageStatus[] {
  const firstOpen = stages.findIndex((stage) => !progress[stage.id]?.passed);
  return stages.map((_, i) =>
    firstOpen === -1 || i < firstOpen ? "passed" : i === firstOpen ? "current" : "locked",
  );
}

export const allPassed = (stages: Stage[], progress: Record<string, StageProgress>) =>
  stages.length > 0 && stages.every((stage) => progress[stage.id]?.passed);

export function recordAttempt(
  progress: Record<string, StageProgress>,
  stageId: string,
  grade: Pick<QuizGrade, "score" | "passed">,
): Record<string, StageProgress> {
  const previous = progress[stageId];
  return {
    ...progress,
    [stageId]: {
      attempts: (previous?.attempts ?? 0) + 1,
      passed: Boolean(previous?.passed) || grade.passed,
      bestScore: Math.max(previous?.bestScore ?? 0, grade.score),
      lastScore: grade.score,
    },
  };
}

export interface MentorFeedback {
  strengths: string[];
  weakPoints: string[];
  alternative: string;
  practiceTask: string;
}

/** Strengths and weak points come from the skills of right and wrong answers. */
export function mentorFeedback(stage: Stage, quiz: Quiz, grade: QuizGrade): MentorFeedback {
  const strong = new Set<string>();
  const weak = new Set<string>();
  quiz.questions.forEach((q, i) => (grade.results[i] ? strong : weak).add(q.skill));
  // A skill missed anywhere is a weak point, even if another question on it was right.
  for (const skill of weak) strong.delete(skill);
  return {
    strengths: [...strong],
    weakPoints: [...weak],
    alternative: stage.mentor.alternative,
    practiceTask: stage.mentor.practiceTask,
  };
}

/** Distinct skills covered by a set of stages, in order of first appearance. */
export const skillsOf = (stages: Stage[]) => [
  ...new Set(stages.flatMap((stage) => stage.quizzes.flatMap((quiz) => quiz.questions.map((q) => q.skill)))),
];

import { normalizeText } from "@/lib/suggest/language";
import type { QuizGrade } from "./grading";
import { levelQuestions } from "./level";
import { hashSeed } from "./random";
import {
  DIFFICULTIES,
  PASS_MARK,
  type Bi,
  type Difficulty,
  type LearnerProfile,
  type Level,
  type PersonalizedQuiz,
  type Question,
  type QuizPlan,
  type QuizSource,
  type Stage,
  type StageHistory,
  type StageProgress,
} from "./types";

export const QUIZ_LENGTH = 5;
const BASELINE: Record<Level, number> = { beginner: 30, intermediate: 50, advanced: 70 };
export const START_DIFFICULTY: Record<Level, Difficulty> = { beginner: "easy", intermediate: "medium", advanced: "hard" };
/** Mastery change per answer: harder questions count more when right, less when wrong. */
const GAIN: Record<Difficulty, number> = { easy: 10, medium: 15, hard: 20 };
const LOSS: Record<Difficulty, number> = { easy: 20, medium: 15, hard: 10 };
const MAX_WRONG = 8;

const clamp = (value: number) => Math.max(0, Math.min(100, Math.round(value)));
const unique = <T,>(items: T[]) => [...new Set(items)];
export const stepDifficulty = (d: Difficulty, delta: number): Difficulty =>
  DIFFICULTIES[Math.max(0, Math.min(2, DIFFICULTIES.indexOf(d) + delta))]!;
/** Normalized prompt used to detect repeated questions. */
export const promptKey = (prompt: string) =>
  normalizeText(prompt).replace(/[^\p{L}\p{N}]+/gu, " ").trim();

export const emptyHistory = (): StageHistory => ({
  asked: [],
  wrong: [],
  lastWrongSkills: [],
  attempts: [],
  pending: null,
});

/** Profile from the level check: difficulty from the level, mastery seeded by its answers. */
export function initialProfile(level: Level, levelAnswers: (number | null)[] = []): LearnerProfile {
  const baseline = BASELINE[level];
  const mastery: Record<string, number> = {};
  levelQuestions.forEach((q, i) => {
    const answer = levelAnswers[i];
    if (answer === null || answer === undefined) return;
    mastery[q.skill] = clamp(baseline + (answer === q.correct ? 15 : -15));
  });
  return { mastery, baseline, difficulty: START_DIFFICULTY[level], history: {} };
}

export const masteryOf = (profile: LearnerProfile, skill: string) =>
  profile.mastery[skill] ?? profile.baseline;

export const stageSkills = (stage: Stage) => unique(stage.bank.map((q) => q.skill));

/**
 * Updates mastery from the skill tags of right and wrong answers, records history, and applies
 * the difficulty rules: below 50% → one step easier; 100% on the first attempt → one step harder.
 */
export function updateProfileAfterQuiz(
  profile: LearnerProfile,
  stageId: string,
  quiz: { id: string; questions: Question[]; source?: QuizSource },
  answers: (number | null)[],
  grade: Pick<QuizGrade, "score" | "passed" | "results">,
): LearnerProfile {
  const history = profile.history[stageId] ?? emptyHistory();
  const mastery = { ...profile.mastery };
  quiz.questions.forEach((q, i) => {
    const current = mastery[q.skill] ?? profile.baseline;
    mastery[q.skill] = clamp(grade.results[i] ? current + GAIN[q.difficulty] : current - LOSS[q.difficulty]);
  });
  const wrong = quiz.questions.flatMap((q, i) =>
    grade.results[i]
      ? []
      : [{ prompt: q.prompt, skill: q.skill, chosen: q.options[answers[i] ?? -1] ?? "", correct: q.options[q.correct] ?? "" }],
  );
  let difficulty = profile.difficulty;
  if (!grade.passed && grade.score < 50) difficulty = stepDifficulty(difficulty, -1);
  if (grade.passed && history.attempts.length === 0 && grade.score === 100) difficulty = stepDifficulty(difficulty, 1);
  return {
    ...profile,
    mastery,
    difficulty,
    history: {
      ...profile.history,
      [stageId]: {
        asked: unique([...history.asked, ...quiz.questions.map((q) => promptKey(q.prompt))]),
        wrong: [...wrong, ...history.wrong].slice(0, MAX_WRONG),
        lastWrongSkills: unique(wrong.map((w) => w.skill)),
        attempts: [...history.attempts, { score: grade.score, quizId: quiz.id, source: quiz.source ?? "local" }],
        pending: null,
      },
    },
  };
}

/** The adaptive rules for the next quiz of `stages[index]`. Deterministic. */
export function planNextQuiz(
  stages: Stage[],
  index: number,
  profile: LearnerProfile,
  progress: Record<string, StageProgress>,
): QuizPlan {
  const stage = stages[index]!;
  const history = profile.history[stage.id] ?? emptyHistory();
  const byMastery = (skills: string[]) =>
    [...skills].sort((a, b) => masteryOf(profile, a) - masteryOf(profile, b) || a.localeCompare(b));
  const skills = stageSkills(stage);
  const base: QuizPlan = {
    kind: "first",
    difficulty: profile.difficulty,
    focusSkills: byMastery(skills).slice(0, 2),
    reviewSkill: null,
    reviewCount: 0,
    raised: false,
    easier: false,
  };
  const last = history.attempts.at(-1);
  if (last && !progress[stage.id]?.passed) {
    // Failed: focus on the skills missed last time, at the same or an easier difficulty.
    const missed = byMastery(history.lastWrongSkills.filter((s) => skills.includes(s)));
    return { ...base, kind: "retry", focusSkills: (missed.length ? missed : base.focusSkills).slice(0, 3), easier: last.score < 50 };
  }
  if (last) return { ...base, kind: "practice" };
  const previous = index > 0 ? profile.history[stages[index - 1]!.id] : undefined;
  if (previous?.attempts.length) {
    const firstTry100 = previous.attempts[0]!.score === 100;
    const passing = previous.attempts.find((a) => a.score >= PASS_MARK);
    // Passed with 80–99%: review the weakest skill assessed so far in earlier stages.
    const earlier = unique(stages.slice(0, index).flatMap(stageSkills)).filter(
      (s) => profile.mastery[s] !== undefined && masteryOf(profile, s) < 100,
    );
    const reviewSkill = !firstTry100 && passing && passing.score < 100 ? (byMastery(earlier)[0] ?? null) : null;
    return {
      ...base,
      kind: "next-stage",
      reviewSkill,
      reviewCount: reviewSkill ? (masteryOf(profile, reviewSkill) < 60 ? 2 : 1) : 0,
      raised: firstTry100,
    };
  }
  return base;
}

/** Ranks questions: focus skills first, then matching difficulty, then a per-learner tie-break. */
function rank(questions: Question[], plan: QuizPlan, seed: string) {
  const score = (q: Question) => {
    const focus = plan.focusSkills.indexOf(q.skill);
    const gap = Math.abs(DIFFICULTIES.indexOf(q.difficulty) - DIFFICULTIES.indexOf(plan.difficulty));
    return (focus >= 0 ? 10 - focus : 0) + (gap === 0 ? 4 : gap === 1 ? 1 : 0) + (hashSeed(`${seed}-${q.id}`) % 1000) / 1000;
  };
  return [...questions].sort((a, b) => score(b) - score(a));
}

/**
 * Local adaptive selection: review questions first (if planned), then the stage bank ranked by
 * the plan. Questions already asked in this stage are used only when no alternatives remain.
 */
export function selectLocalQuestions(
  stages: Stage[],
  index: number,
  plan: QuizPlan,
  profile: LearnerProfile,
  seed: string,
): Question[] {
  const stage = stages[index]!;
  const asked = new Set(profile.history[stage.id]?.asked ?? []);
  const askedAnywhere = new Set(Object.values(profile.history).flatMap((h) => h.asked));
  const chosen: Question[] = [];
  const take = (question: Question) => {
    if (chosen.length < QUIZ_LENGTH && !chosen.some((q) => promptKey(q.prompt) === promptKey(question.prompt)))
      chosen.push(question);
  };
  if (plan.reviewSkill) {
    const pool = stages.slice(0, index).flatMap((s) => s.bank).filter((q) => q.skill === plan.reviewSkill && !asked.has(promptKey(q.prompt)));
    const fresh = pool.filter((q) => !askedAnywhere.has(promptKey(q.prompt)));
    [...rank(fresh, plan, seed), ...rank(pool, plan, seed)].slice(0, QUIZ_LENGTH).forEach((q) => {
      if (chosen.filter((c) => c.skill === plan.reviewSkill).length < plan.reviewCount) take(q);
    });
  }
  const fresh = rank(stage.bank.filter((q) => !asked.has(promptKey(q.prompt))), plan, seed);
  const seen = rank(stage.bank.filter((q) => asked.has(promptKey(q.prompt))), plan, seed);
  // Fresh questions first: at most 2 per focus skill and 1 per other skill, then any fresh one.
  // Already-asked questions are used only when no fresh alternatives remain.
  const perSkill = (skill: string) => chosen.filter((q) => q.skill === skill).length;
  for (const q of fresh) if (perSkill(q.skill) < (plan.focusSkills.includes(q.skill) ? 2 : 1)) take(q);
  for (const q of fresh) take(q);
  for (const q of seen) take(q);
  return chosen;
}

/** Prewritten explanation for the weakest skill: the bank's notes on it plus the stage analogy. */
export function localExplanation(stages: Stage[], index: number, plan: QuizPlan) {
  const stage = stages[index]!;
  const skill = plan.focusSkills[0] ?? plan.reviewSkill ?? stageSkills(stage)[0] ?? "";
  const notes = unique(stages.slice(0, index + 1).flatMap((s) => s.bank).filter((q) => q.skill === skill).map((q) => q.explanation)).slice(0, 3);
  return `${skill}: ${notes.join(" ")} ${stage.mentor.alternative}`.trim();
}

export function buildLocalQuiz(
  stages: Stage[],
  index: number,
  plan: QuizPlan,
  profile: LearnerProfile,
  learnerId: string,
  language: PersonalizedQuiz["language"],
): PersonalizedQuiz {
  const stage = stages[index]!;
  const attempt = profile.history[stage.id]?.attempts.length ?? 0;
  return {
    id: `${stage.id}-local-${learnerId}-${attempt + 1}`,
    stageId: stage.id,
    attempt,
    source: "local",
    plan,
    language,
    explanation: localExplanation(stages, index, plan),
    practiceTask: stage.mentor.practiceTask,
    questions: selectLocalQuestions(stages, index, plan, profile, `${learnerId}-${stage.id}-${attempt}`),
  };
}

const difficultyName: Record<Difficulty, Bi> = {
  easy: { en: "easy", ar: "سهل" },
  medium: { en: "medium", ar: "متوسط" },
  hard: { en: "hard", ar: "صعب" },
};
export const difficultyLabel = (d: Difficulty) => difficultyName[d];

/** The "Why this quiz" sentence, in English and Arabic. */
export function whyThisQuiz(plan: QuizPlan): Bi {
  const list = plan.focusSkills.join(" and ") || "this stage's skills";
  const d = difficultyName[plan.difficulty];
  switch (plan.kind) {
    case "retry":
      return {
        en: `Focuses on ${list} because you missed ${plan.focusSkills.length > 1 ? "them" : "it"} last time${plan.easier ? ", one step easier" : ""}; difficulty: ${d.en}.`,
        ar: `يركّز على ${list} لأنك أخطأت فيها في المحاولة السابقة${plan.easier ? "، بمستوى أسهل بدرجة" : ""}؛ الصعوبة: ${d.ar}.`,
      };
    case "next-stage": {
      const review = plan.reviewSkill
        ? { en: `, plus ${plan.reviewCount} review question${plan.reviewCount > 1 ? "s" : ""} on ${plan.reviewSkill}, your weakest skill so far`, ar: `، مع ${plan.reviewCount === 1 ? "سؤال مراجعة واحد" : "سؤالي مراجعة"} عن ${plan.reviewSkill}، أضعف مهاراتك حتى الآن` }
        : { en: "", ar: "" };
      const raised = plan.raised
        ? { en: " You scored 100% on your first try last stage, so the difficulty went up.", ar: " حصلت على 100% من المحاولة الأولى في المرحلة السابقة، لذلك ارتفعت الصعوبة." }
        : { en: "", ar: "" };
      return {
        en: `Starts with ${list}, your lowest mastery in this stage${review.en}; difficulty: ${d.en}.${raised.en}`,
        ar: `يبدأ بـ ${list}، الأقل إتقاناً لديك في هذه المرحلة${review.ar}؛ الصعوبة: ${d.ar}.${raised.ar}`,
      };
    }
    case "practice":
      return {
        en: `A practice round on ${list}, your lowest mastery here; difficulty: ${d.en}.`,
        ar: `جولة تدريب على ${list}، الأقل إتقاناً لديك هنا؛ الصعوبة: ${d.ar}.`,
      };
    default:
      return {
        en: `Starts with ${list}, your lowest mastery in this stage so far (from your level check and answers); difficulty: ${d.en}.`,
        ar: `يبدأ بـ ${list}، الأقل إتقاناً لديك في هذه المرحلة حتى الآن (حسب تحديد المستوى وإجاباتك)؛ الصعوبة: ${d.ar}.`,
      };
  }
}

import { questionText } from "./i18n";
import { levelQuestions } from "./level";
import { misconceptionById, misconceptionForRecord, type KnownMisconception } from "./misconceptions";
import { buildPath } from "./path";
import { basics, learningProjects } from "./projects";
import { PASS_MARK, type JourneyState, type Language, type Question, type QuizSource, type Stage } from "./types";

/**
 * Local learning insights: plain counting over the answer records and attempts saved on this
 * device (the learner; the function accepts several learners, as the full platform would). No AI is
 * involved.
 */
export interface LearnerData {
  learner: string;
  state: JourneyState;
}

export interface MisconceptionStat {
  misconception: KnownMisconception;
  /** Wrong answers that matched it. */
  count: number;
  /** Learners who showed it at least once. */
  learners: number;
}

export interface QuestionStat {
  questionId: string;
  skill: string;
  prompt: string;
  answered: number;
  correct: number;
  /** Percentage of correct answers, rounded. */
  rate: number;
}

export interface ExplanationStat {
  stageId: string;
  stageTitle: string;
  skill: string;
  /** Who wrote the re-explanation shown before the retry: prewritten (local) or Gemini. */
  source: QuizSource;
  /** Retries that started with this explanation, and how many of them passed. */
  shown: number;
  passed: number;
}

export interface LearningInsights {
  learners: number;
  answers: number;
  wrongAnswers: number;
  attempts: number;
  misconceptions: MisconceptionStat[];
  hardestQuestions: QuestionStat[];
  explanations: ExplanationStat[];
}

/** Every local question and stage a learner could have seen, for titles and translated prompts. */
function catalogue(data: LearnerData[]) {
  const stages = new Map<string, Stage>();
  for (const stage of [basics, ...learningProjects.flatMap((p) => p.stages), ...data.flatMap((d) => buildPath(d.state))])
    stages.set(stage.id, stage);
  const questions = new Map<string, Question>();
  for (const q of [...levelQuestions, ...[...stages.values()].flatMap((s) => s.bank)]) questions.set(q.id, q);
  return { stages, questions };
}

export function aggregateInsights(data: LearnerData[], language: Language, { top = 5 } = {}): LearningInsights {
  const { stages, questions } = catalogue(data);
  const records = data.flatMap((d) => (d.state.profile?.answers ?? []).map((record) => ({ learner: d.learner, record })));

  const byMisconception = new Map<string, { count: number; learners: Set<string> }>();
  for (const { learner, record } of records) {
    const found = misconceptionForRecord(record);
    if (!found) continue;
    const entry = byMisconception.get(found.id) ?? { count: 0, learners: new Set<string>() };
    entry.count += 1;
    entry.learners.add(learner);
    byMisconception.set(found.id, entry);
  }
  const misconceptions = [...byMisconception]
    .map(([id, e]) => ({ misconception: misconceptionById(id)!, count: e.count, learners: e.learners.size }))
    .sort((a, b) => b.count - a.count || b.learners - a.learners || a.misconception.id.localeCompare(b.misconception.id))
    .slice(0, top);

  const byQuestion = new Map<string, QuestionStat>();
  for (const { record } of records) {
    const local = questions.get(record.questionId);
    const entry = byQuestion.get(record.questionId) ?? {
      questionId: record.questionId,
      skill: record.skill,
      prompt: local ? questionText(local, language).prompt : record.prompt,
      answered: 0,
      correct: 0,
      rate: 0,
    };
    entry.answered += 1;
    if (record.isCorrect) entry.correct += 1;
    entry.rate = Math.round((entry.correct / entry.answered) * 100);
    byQuestion.set(record.questionId, entry);
  }
  const hardestQuestions = [...byQuestion.values()]
    .filter((q) => q.correct < q.answered)
    .sort((a, b) => a.rate - b.rate || b.answered - a.answered || a.questionId.localeCompare(b.questionId))
    .slice(0, top);

  // A retry starts with a re-explanation of the missed skill: did that attempt pass?
  const byExplanation = new Map<string, ExplanationStat>();
  for (const d of data)
    for (const [stageId, history] of Object.entries(d.state.profile?.history ?? {}))
      history.attempts.forEach((attempt, i) => {
        if (attempt.kind !== "retry" || i === 0 || !attempt.focusSkill) return;
        const key = `${stageId}|${attempt.focusSkill}|${attempt.source}`;
        const entry = byExplanation.get(key) ?? {
          stageId,
          stageTitle: stages.get(stageId)?.title[language] ?? stageId,
          skill: attempt.focusSkill,
          source: attempt.source,
          shown: 0,
          passed: 0,
        };
        entry.shown += 1;
        if (attempt.score >= PASS_MARK) entry.passed += 1;
        byExplanation.set(key, entry);
      });
  const explanations = [...byExplanation.values()].sort(
    (a, b) => b.passed / b.shown - a.passed / a.shown || b.shown - a.shown || a.stageId.localeCompare(b.stageId),
  );

  return {
    learners: data.filter((d) => d.state.profile).length,
    answers: records.length,
    wrongAnswers: records.filter(({ record }) => !record.isCorrect).length,
    attempts: data.reduce(
      (sum, d) => sum + Object.values(d.state.profile?.history ?? {}).reduce((n, h) => n + h.attempts.length, 0),
      0,
    ),
    misconceptions,
    hardestQuestions,
    explanations,
  };
}

/**
 * Anonymized export of answer records and outcomes. Learners become "learner-1", "learner-2";
 * names, project titles and descriptions are left out, and no settings (such as the API key) are
 * read. This is the format later analysis or model training would use.
 */
export function anonymizedExport(data: LearnerData[], now: Date = new Date()) {
  return {
    format: "aipm.learning-records",
    version: 1,
    exportedAt: now.toISOString(),
    notice:
      "Local demo data from one device. Anonymized: no names, project titles or descriptions, and no API keys. In the full platform this would be aggregated across all students.",
    passMark: PASS_MARK,
    learners: data
      .filter((d) => d.state.profile)
      .map((d, i) => {
        const { state } = d;
        const profile = state.profile!;
        return {
          learner: `learner-${i + 1}`,
          level: state.level,
          project: state.project ? (state.project.id === "custom" ? "custom" : state.project.id) : null,
          parts: state.parts.map((p) => ({ key: p.key, quantity: p.quantity })),
          difficulty: profile.difficulty,
          mastery: profile.mastery,
          stages: Object.entries(state.progress).map(([stageId, p]) => ({
            stageId,
            passed: p.passed,
            bestScore: p.bestScore,
            attempts: p.attempts,
          })),
          attempts: Object.entries(profile.history).flatMap(([stageId, history]) =>
            history.attempts.map((a, n) => ({
              stageId,
              attempt: n + 1,
              score: a.score,
              passed: a.score >= PASS_MARK,
              quizSource: a.source,
              planKind: a.kind ?? null,
              focusSkill: a.focusSkill ?? null,
            })),
          ),
          answers: profile.answers.map((r) => ({
            questionId: r.questionId,
            stageId: r.stageId,
            skill: r.skill,
            difficulty: r.difficulty,
            source: r.source,
            prompt: r.prompt,
            chosen: r.chosen,
            chosenIndex: r.chosenIndex,
            correctAnswer: r.correctAnswer,
            correctIndex: r.correctIndex,
            isCorrect: r.isCorrect,
            misconceptionId: misconceptionForRecord(r)?.id ?? null,
          })),
        };
      }),
  };
}

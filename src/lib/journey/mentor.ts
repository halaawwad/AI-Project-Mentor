import { masteryOf, skillNotes, stageSkills } from "./adaptive";
import { questionText, skillLabel, stageText } from "./i18n";
import { levelQuestions } from "./level";
import { misconceptionForRecord } from "./misconceptions";
import {
  PASS_MARK,
  type AnswerRecord,
  type Diagnosis,
  type JourneyState,
  type Language,
  type LearnerProfile,
  type LearningPlan,
  type Level,
  type MentorInsight,
  type MentorState,
  type PlanAction,
  type PlanItem,
  type Question,
  type Stage,
  type StageProgress,
} from "./types";

/** Below this many answer records the analysis must say its confidence is low. */
export const MIN_CONFIDENT_RECORDS = 6;
export const MAX_REMEDIALS = 3;
export const MAX_MISCONCEPTIONS = 4;
export const PLAN_ACTIONS: PlanAction[] = ["keep", "add-remedial", "shorten", "skippable"];

export const actionNames: Record<PlanAction, { en: string; ar: string }> = {
  keep: { en: "keep", ar: "كما هي" },
  "add-remedial": { en: "added", ar: "مُضاف" },
  shorten: { en: "shortened", ar: "مختصرة" },
  skippable: { en: "skippable", ar: "يمكن تخطيها" },
};

const unique = <T,>(items: T[]) => [...new Set(items)];
const t =(language: Language, en: string, ar: string) => (language === "ar" ? ar : en);

/** Everything the diagnosis and plan are built from, for one learner at one checkpoint. */
export interface MentorContext {
  stages: Stage[];
  progress: Record<string, StageProgress>;
  profile: LearnerProfile;
  level: Level;
  language: Language;
  projectTitle: string;
  projectParts: string[];
  /** The plan before this checkpoint, if any. */
  previous: MentorState["previous"];
}

/** Skill tags a plan's remedial items may use: the skills taught in the path. */
export const pathSkills = (stages: Stage[]) => unique(stages.flatMap(stageSkills));
/** Skill tags a diagnosis may use: the path's skills plus the level-check skills. */
export const diagnosisSkills = (stages: Stage[]) =>
  unique([...pathSkills(stages), ...levelQuestions.map((q) => q.skill)]);

/** Skills with evidence (assessed or answered) and skills with at least one recent wrong answer. */
export function evidence(profile: LearnerProfile) {
  const assessed = new Set([...Object.keys(profile.mastery), ...profile.answers.map((r) => r.skill)]);
  const wrong = new Set(profile.answers.filter((r) => !r.isCorrect).map((r) => r.skill));
  return { assessed, wrong };
}

/**
 * The checkpoint a diagnosis and plan belong to: "level" right after the level check, then
 * "stage:<id>" after each completed stage. Practice quizzes on passed stages don't change it.
 */
export function mentorCheckpoint(
  state: Pick<JourneyState, "level" | "progress">,
  stages: Stage[],
): string | null {
  if (!state.level || !stages.length) return null;
  const passed = stages.filter((stage) => state.progress[stage.id]?.passed);
  return passed.length ? `stage:${passed.at(-1)!.id}` : "level";
}

/** The cached insight for this checkpoint in the current language (no request needed). */
export function cachedInsight(state: Pick<JourneyState, "mentor" | "language">, checkpoint: string) {
  const mentor = state.mentor;
  if (!mentor || mentor.checkpoint !== checkpoint) return null;
  return mentor.insights.find((insight) => insight.language === state.language) ?? null;
}

/** The most recent insight, preferring the current language; may be from an earlier checkpoint. */
export function latestInsight(state: Pick<JourneyState, "mentor" | "language">): MentorInsight | null {
  const insights = state.mentor?.insights ?? [];
  return insights.find((insight) => insight.language === state.language) ?? insights[0] ?? null;
}

/** The plan to compare against when an insight for `checkpoint` is made. */
export function previousPlanFor(mentor: MentorState | null, checkpoint: string, language: Language): MentorState["previous"] {
  if (!mentor) return null;
  if (mentor.checkpoint === checkpoint) return mentor.previous;
  const prior = mentor.insights.find((i) => i.language === language) ?? mentor.insights[0];
  return prior ? { checkpoint: mentor.checkpoint, source: prior.source, items: prior.plan.items } : mentor.previous;
}

/** Stores an insight: same checkpoint → replaces that language; new checkpoint → keeps the old plan as `previous`. */
export function withInsight(mentor: MentorState | null, insight: MentorInsight): MentorState {
  if (mentor && mentor.checkpoint === insight.checkpoint)
    return { ...mentor, insights: [...mentor.insights.filter((i) => i.language !== insight.language), insight] };
  return {
    checkpoint: insight.checkpoint,
    insights: [insight],
    previous: previousPlanFor(mentor, insight.checkpoint, insight.language),
  };
}

/**
 * The plan's items if they still match the path exactly (every stage once, in path order);
 * otherwise null, and the plain path is shown instead.
 */
export function effectivePlan(stages: Stage[], insight: MentorInsight | null): PlanItem[] | null {
  if (!insight) return null;
  const ids = insight.plan.items.filter((item) => item.kind === "stage").map((item) => item.target);
  return ids.length === stages.length && ids.every((id, i) => id === stages[i]!.id) ? insight.plan.items : null;
}

/** The plan item for one stage, and the remedial items placed right before it. */
export function planForStage(items: PlanItem[] | null, stageId: string) {
  if (!items) return { item: null, remedials: [] as PlanItem[] };
  const at = items.findIndex((item) => item.kind === "stage" && item.target === stageId);
  const remedials: PlanItem[] = [];
  for (let i = at - 1; i >= 0 && items[i]!.kind === "remedial"; i--) remedials.unshift(items[i]!);
  return { item: at >= 0 ? items[at]! : null, remedials };
}

export type PlanChange =
  | { kind: "added-remedial" | "removed-remedial"; skill: string }
  | { kind: "action"; stageId: string; from: PlanAction; to: PlanAction };

/** What changed between two plans: remedial items added or removed, and stage actions changed. */
export function planChanges(previous: PlanItem[], next: PlanItem[]): PlanChange[] {
  const remedials = (items: PlanItem[]) => items.filter((i) => i.kind === "remedial").map((i) => i.target);
  const before = remedials(previous);
  const after = remedials(next);
  const actions = new Map(previous.filter((i) => i.kind === "stage").map((i) => [i.target, i.action]));
  return [
    ...after.filter((s) => !before.includes(s)).map((skill) => ({ kind: "added-remedial" as const, skill })),
    ...before.filter((s) => !after.includes(s)).map((skill) => ({ kind: "removed-remedial" as const, skill })),
    ...next
      .filter((i) => i.kind === "stage" && actions.has(i.target) && actions.get(i.target) !== i.action)
      .map((i) => ({ kind: "action" as const, stageId: i.target, from: actions.get(i.target)!, to: i.action })),
  ];
}

// ---------------------------------------------------------------------------------------------
// Local rules (fallback): built only from mastery and answer records.

const allQuestions = (stages: Stage[]): Question[] => [...levelQuestions, ...stages.flatMap((s) => s.bank)];

/** A recorded mistake in the requested language: local questions are looked up by id. */
export function mistakeText(record: AnswerRecord, stages: Stage[], language: Language) {
  const question = allQuestions(stages).find((q) => q.id === record.questionId);
  const text = question ? questionText(question, language) : null;
  const prompt = text?.prompt ?? record.prompt;
  const chosen = record.chosenIndex === null ? "" : (text?.options[record.chosenIndex] ?? record.chosen);
  const correct = text?.options[record.correctIndex] ?? record.correctAnswer;
  return chosen
    ? t(language, `Chose “${chosen}” instead of “${correct}” — ${prompt}`, `اخترت «${chosen}» بدلاً من «${correct}» — ${prompt}`)
    : t(language, `Left unanswered; the answer is “${correct}” — ${prompt}`, `تُرك دون إجابة؛ الإجابة «${correct}» — ${prompt}`);
}

interface SkillStats {
  total: number;
  wrong: number;
  latestCorrect: boolean;
}

function skillStats(records: AnswerRecord[]) {
  const stats = new Map<string, SkillStats>();
  // Records are newest first, so the first record seen per skill is the latest.
  for (const record of records) {
    const entry = stats.get(record.skill) ?? { total: 0, wrong: 0, latestCorrect: record.isCorrect };
    entry.total += 1;
    if (!record.isCorrect) entry.wrong += 1;
    stats.set(record.skill, entry);
  }
  return stats;
}

/**
 * Rule-based diagnosis. Weak: at least one wrong answer, and the latest answer was wrong or
 * mastery is below 50. Strong: the latest answer was right and at most a quarter were wrong.
 */
export function localDiagnosis(ctx: Pick<MentorContext, "stages" | "profile" | "language">): Diagnosis {
  const { profile, stages, language } = ctx;
  const allowed = new Set(diagnosisSkills(stages));
  const stats = skillStats(profile.answers.filter((r) => allowed.has(r.skill)));
  const byMastery = (skills: string[]) =>
    [...skills].sort((a, b) => masteryOf(profile, a) - masteryOf(profile, b) || a.localeCompare(b));
  const weakSkills = byMastery(
    [...stats].filter(([skill, s]) => s.wrong > 0 && (!s.latestCorrect || masteryOf(profile, skill) < 50)).map(([skill]) => skill),
  ).slice(0, 5);
  const strengths = byMastery(
    [...stats].filter(([skill, s]) => !weakSkills.includes(skill) && s.latestCorrect && s.wrong / s.total <= 0.25).map(([skill]) => skill),
  )
    .reverse()
    .slice(0, 5);
  const seen = new Set<string>();
  const misconceptions = profile.answers
    .filter((r) => !r.isCorrect && allowed.has(r.skill) && !seen.has(r.skill) && seen.add(r.skill))
    .slice(0, 3)
    .map((r) => {
      const known = misconceptionForRecord(r);
      const pattern = known ? t(language, ` Known pattern: ${known.description.en}`, ` نمط معروف: ${known.description.ar}`) : "";
      return { skill: r.skill, text: `${mistakeText(r, stages, language)}${pattern}` };
    });
  const n = profile.answers.length;
  const confidence = n < MIN_CONFIDENT_RECORDS ? "low" : n < 15 ? "medium" : "high";
  const confidenceNote =
    confidence === "low"
      ? t(language, `Based on only ${n} answers; the analysis gets more reliable after your first stage quiz.`, `مبني على ${n} إجابات فقط؛ يصبح التحليل أدق بعد اختبار مرحلتك الأولى.`)
      : t(language, `Based on your last ${n} answers.`, `مبني على آخر ${n} إجابة لك.`);
  const names = (skills: string[]) => skills.map((s) => skillLabel(s, language)).join(t(language, ", ", "، "));
  const summary = [
    t(language, `${n} answers analysed with local rules.`, `حُلّلت ${n} إجابة بالقواعد المحلية.`),
    strengths.length ? t(language, `Strongest: ${names(strengths)}.`, `الأقوى: ${names(strengths)}.`) : "",
    weakSkills.length
      ? t(language, `Needs work: ${names(weakSkills)}.`, `يحتاج تحسيناً: ${names(weakSkills)}.`)
      : t(language, "No weak skill found yet.", "لم تظهر مهارة ضعيفة بعد."),
  ]
    .filter(Boolean)
    .join(" ");
  return { summary, strengths, weakSkills, misconceptions, confidence, confidenceNote };
}

/** Bilingual "What changed and why" from the plan diff. */
export function describeChanges(changes: PlanChange[], stages: Stage[], language: Language) {
  if (!changes.length) return t(language, "No changes to your plan.", "لا تغييرات على خطتك.");
  const title = (id: string) => stages.find((s) => s.id === id)?.title[language] ?? id;
  return changes
    .map((c) =>
      c.kind === "action"
        ? t(
            language,
            `${title(c.stageId)}: ${actionNames[c.from].en} → ${actionNames[c.to].en}.`,
            `${title(c.stageId)}: ${actionNames[c.from].ar} ← ${actionNames[c.to].ar}.`,
          )
        : c.kind === "added-remedial"
          ? t(language, `Added a mini-lesson on ${skillLabel(c.skill, language)}.`, `أُضيف درس قصير عن ${skillLabel(c.skill, language)}.`)
          : t(language, `Removed the mini-lesson on ${skillLabel(c.skill, language)}.`, `أُزيل الدرس القصير عن ${skillLabel(c.skill, language)}.`),
    )
    .join(" ");
}

/**
 * Rule-based plan: the path as it is, with a remedial mini-lesson for up to two weak skills,
 * placed before the first open stage that teaches the skill. Local rules never shorten or skip.
 */
export function localPlan(ctx: Pick<MentorContext, "stages" | "progress" | "profile" | "language" | "previous">, diagnosis: Diagnosis): LearningPlan {
  const { stages, progress, profile, language } = ctx;
  const skills = new Set(pathSkills(stages));
  const firstOpen = stages.findIndex((s) => !progress[s.id]?.passed);
  const stats = skillStats(profile.answers);
  const remedialAt = new Map<number, string[]>();
  if (firstOpen >= 0)
    for (const skill of diagnosis.weakSkills.filter((s) => skills.has(s)).slice(0, 2)) {
      const teaches = stages.findIndex((s, i) => i >= firstOpen && stageSkills(s).includes(skill));
      const at = teaches >= 0 ? teaches : firstOpen;
      remedialAt.set(at, [...(remedialAt.get(at) ?? []), skill]);
    }
  const items: PlanItem[] = [];
  stages.forEach((stage, i) => {
    for (const skill of remedialAt.get(i) ?? []) {
      const s = stats.get(skill);
      items.push({
        kind: "remedial",
        target: skill,
        action: "add-remedial",
        reason: t(
          language,
          `Mastery ${masteryOf(profile, skill)}/100${s ? `, ${s.wrong} of your last ${s.total} answers on it wrong` : ""}.`,
          `الإتقان ${masteryOf(profile, skill)}/100${s ? `، وأخطأت في ${s.wrong} من آخر ${s.total} إجابات عنها` : ""}.`,
        ),
        explanation: "",
      });
    }
    const done = progress[stage.id];
    const own = stageSkills(stage);
    const assessed = own.filter((s) => profile.mastery[s] !== undefined);
    const average = assessed.length ? Math.round(assessed.reduce((sum, s) => sum + masteryOf(profile, s), 0) / assessed.length) : null;
    items.push({
      kind: "stage",
      target: stage.id,
      action: "keep",
      reason: done?.passed
        ? t(language, `Completed, best score ${done.bestScore}% (pass mark ${PASS_MARK}%).`, `مكتملة، أفضل نتيجة ${done.bestScore}% (علامة النجاح ${PASS_MARK}%).`)
        : average === null
          ? t(language, "Part of your project path; its skills aren't assessed yet.", "جزء من مسار مشروعك؛ لم تُقيَّم مهاراتها بعد.")
          : t(language, `Part of your project path; your average mastery of its skills is ${average}/100.`, `جزء من مسار مشروعك؛ متوسط إتقانك لمهاراتها ${average}/100.`),
      explanation: "",
    });
  });
  const changeNote = ctx.previous
    ? describeChanges(planChanges(ctx.previous.items, items), stages, language)
    : t(language, "Your first plan, from the level check.", "خطتك الأولى، من تحديد المستوى.");
  return { items, changeNote };
}

export function buildLocalInsight(ctx: MentorContext, checkpoint: string, learnerId: string): MentorInsight {
  const diagnosis = localDiagnosis(ctx);
  return {
    id: `${checkpoint}-local-${learnerId}-${ctx.language}`,
    checkpoint,
    source: "local",
    language: ctx.language,
    basedOn: ctx.profile.answers.length,
    diagnosis,
    plan: localPlan(ctx, diagnosis),
  };
}

/** Local content for a remedial mini-lesson: the bank's notes on the skill plus a stage analogy. */
export function remedialLesson(stages: Stage[], skill: string, language: Language) {
  const teaching = stages.find((s) => stageSkills(s).includes(skill));
  return {
    notes: skillNotes(stages, skill, language),
    analogy: teaching ? stageText(teaching, language).mentor.alternative : "",
    stageId: teaching?.id ?? null,
  };
}

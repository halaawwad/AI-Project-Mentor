import { describe, expect, it } from "vitest";
import { initialProfile, localExplanation, planNextQuiz, stageSkills, whyThisQuiz } from "../lib/journey/adaptive";
import { arabicStages } from "../lib/journey/content.ar";
import { buildGenericPath } from "../lib/journey/generic";
import { hasArabic, skillLabelsAr, stageText } from "../lib/journey/i18n";
import { levelInfo, levelQuestions, selfRatings } from "../lib/journey/level";
import { basics, learningProjects } from "../lib/journey/projects";
import type { Question, QuizPlan, Stage } from "../lib/journey/types";

const writtenStages = [basics, ...learningProjects.flatMap((p) => p.stages)];
const genericStages = buildGenericPath([
  { key: "esp32_devkit_v1", quantity: 1 },
  { key: "dht22", quantity: 1 },
  { key: "oled_096", quantity: 1 },
  { key: "relay_5v", quantity: 1 },
  { key: "push_button", quantity: 1 },
  { key: "hc05_bluetooth", quantity: 1 },
]);
const allStages: Stage[] = [...writtenStages, ...genericStages];
const allQuestions = (stage: Stage) => [...stage.bank, ...stage.quizzes.flatMap((q) => q.questions)];

function expectBilingualQuestion(q: Question) {
  expect(q.prompt.trim()).not.toBe("");
  expect(q.explanation.trim()).not.toBe("");
  expect(q.ar, `Arabic text for ${q.id}`).toBeDefined();
  const ar = q.ar!;
  expect(hasArabic(ar.prompt), `Arabic prompt for ${q.id}`).toBe(true);
  expect(hasArabic(ar.explanation), `Arabic explanation for ${q.id}`).toBe(true);
  expect(ar.options).toHaveLength(q.options.length);
  for (const option of ar.options) expect(option.trim()).not.toBe("");
  expect(new Set(ar.options).size).toBe(4);
}

describe("bilingual local content", () => {
  it("has Arabic and English for every stage's goal, explanation, mentor text and practice task", () => {
    for (const stage of allStages) {
      for (const lang of ["en", "ar"] as const) {
        const text = stageText(stage, lang);
        for (const value of [text.goal, text.explanation, text.mentor.alternative, text.mentor.practiceTask])
          expect(value.trim(), `${stage.id} ${lang}`).not.toBe("");
      }
      const ar = stageText(stage, "ar");
      for (const value of [ar.goal, ar.explanation, ar.mentor.alternative, ar.mentor.practiceTask])
        expect(hasArabic(value), `${stage.id} Arabic`).toBe(true);
      expect(hasArabic(stage.title.ar)).toBe(true);
      expect(stage.title.en.trim()).not.toBe("");
    }
  });

  it("has Arabic and English for every question in every bank, all difficulties included", () => {
    for (const stage of allStages) for (const q of allQuestions(stage)) expectBilingualQuestion(q);
    for (const q of levelQuestions) expectBilingualQuestion(q);
  });

  it("keeps the Arabic correct answer at the same index as the English one", () => {
    // In the source, option 0 is correct in both languages; after the shared shuffle the
    // Arabic option at `correct` must still be the Arabic source's first option.
    for (const stage of writtenStages) {
      const ar = arabicStages[stage.id]!;
      const sources = [...ar.quizzes[0], ...ar.quizzes[1], ...ar.extra];
      expect(stage.bank).toHaveLength(sources.length);
      stage.bank.forEach((q, i) => expect(q.ar!.options[q.correct]).toBe(sources[i]![1][0]));
    }
  });

  it("has an Arabic name for every skill tag, including generated and level-check skills", () => {
    const skills = new Set([...allStages.flatMap(stageSkills), ...levelQuestions.map((q) => q.skill)]);
    for (const skill of skills) expect(skillLabelsAr[skill], skill).toBeTruthy();
  });

  it("has Arabic and English for level-check labels, projects and Why-this-quiz texts", () => {
    for (const rating of selfRatings) expect(hasArabic(rating.label.ar) && rating.label.en.length > 0).toBe(true);
    for (const info of Object.values(levelInfo)) {
      expect(hasArabic(info.title.ar) && hasArabic(info.path.ar)).toBe(true);
      expect(info.title.en.length && info.path.en.length).toBeTruthy();
    }
    for (const project of learningProjects) {
      for (const text of [project.title, project.summary, project.difficulty, ...(project.note ? [project.note] : [])]) {
        expect(text.en.trim()).not.toBe("");
        expect(hasArabic(text.ar)).toBe(true);
      }
    }
    const base: QuizPlan = { kind: "first", difficulty: "easy", focusSkills: ["Ohm's law"], reviewSkill: null, reviewCount: 0, raised: false, easier: false };
    for (const plan of [
      base,
      { ...base, kind: "retry", easier: true },
      { ...base, kind: "next-stage", reviewSkill: "LED polarity", reviewCount: 2, raised: true },
      { ...base, kind: "practice" },
    ] as QuizPlan[]) {
      const why = whyThisQuiz(plan);
      expect(why.en).toContain("Ohm's law");
      expect(why.ar).toContain(skillLabelsAr["Ohm's law"]!);
      expect(why.ar).not.toContain("Ohm's law");
    }
  });

  it("writes the prewritten weak-skill explanation and practice task in the chosen language", () => {
    const stages = learningProjects.find((p) => p.id === "traffic-light")!.stages;
    const profile = initialProfile("intermediate");
    const plan = planNextQuiz(stages, 0, profile, {});
    const ar = localExplanation(stages, 0, plan, "ar");
    const en = localExplanation(stages, 0, plan, "en");
    expect(hasArabic(ar)).toBe(true);
    expect(ar.startsWith(skillLabelsAr[plan.focusSkills[0]!]!)).toBe(true);
    expect(hasArabic(en)).toBe(false);
    expect(en.startsWith(plan.focusSkills[0]!)).toBe(true);
  });
});

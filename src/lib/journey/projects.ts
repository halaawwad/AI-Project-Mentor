import { normalizeText } from "@/lib/suggest/language";
import { basicsStage, irrigationStages, parkingStages, trafficStages, type RawQuestion, type RawStage } from "./content";
import { arabicStages, type ArQuestion } from "./content.ar";
import { seededShuffle } from "./random";
import type { Difficulty, LearningProject, LearningProjectId, Question, Quiz, Stage } from "./types";

/**
 * Builds a question whose options are shuffled deterministically; `options[0]` is correct.
 * Arabic options (same source order) get the same permutation, so `correct` holds for both.
 */
export function buildQuestion(
  id: string,
  [skill, prompt, options, explanation]: RawQuestion,
  difficulty: Difficulty = "medium",
  ar?: ArQuestion,
): Question {
  const order = seededShuffle([0, 1, 2, 3], id);
  return {
    id,
    skill,
    difficulty,
    prompt,
    options: order.map((i) => options[i]!),
    correct: order.indexOf(0),
    explanation,
    ...(ar ? { ar: { prompt: ar[0], options: order.map((i) => ar[1][i]!), explanation: ar[2] } } : {}),
  };
}

const letter: Record<string, Difficulty> = { e: "easy", m: "medium", h: "hard" };

const buildQuiz = (stageId: string, version: number, raw: RawQuestion[], levels: string, ar: ArQuestion[]): Quiz => {
  const id = `${stageId}-${version === 0 ? "a" : "b"}`;
  return {
    id,
    questions: raw.map((q, i) => buildQuestion(`${id}-${i + 1}`, q, letter[levels[i] ?? "m"] ?? "medium", ar[i])),
  };
};

export function buildStage(raw: RawStage): Stage {
  const ar = arabicStages[raw.id];
  if (
    !ar ||
    ar.quizzes[0].length !== raw.quizzes[0].length ||
    ar.quizzes[1].length !== raw.quizzes[1].length ||
    ar.extra.length !== raw.extra.length
  )
    throw new Error(`Arabic content for stage "${raw.id}" is missing or doesn't match the English.`);
  const quizzes: [Quiz, Quiz] = [
    buildQuiz(raw.id, 0, raw.quizzes[0], raw.difficulty[0], ar.quizzes[0]),
    buildQuiz(raw.id, 1, raw.quizzes[1], raw.difficulty[1], ar.quizzes[1]),
  ];
  const extra = raw.extra.map(([skill, prompt, options, explanation, difficulty], i) =>
    buildQuestion(`${raw.id}-x-${i + 1}`, [skill, prompt, options, explanation], difficulty, ar.extra[i]),
  );
  return {
    id: raw.id,
    title: raw.title,
    goal: raw.goal,
    explanation: raw.explanation,
    parts: raw.parts,
    mentor: raw.mentor,
    ar: { goal: ar.goal, explanation: ar.explanation, mentor: ar.mentor },
    quizzes,
    bank: [...quizzes[0].questions, ...quizzes[1].questions, ...extra],
    source: "written",
  };
}

export const basics = buildStage(basicsStage);

/** The three fully written learning projects, in the order offered to students. */
export const learningProjects: LearningProject[] = [
  {
    id: "traffic-light",
    title: { en: "Traffic light", ar: "إشارة المرور" },
    summary: {
      en: "A red–amber–green light with a pedestrian button. A first project for LEDs, resistors, timing and inputs.",
      ar: "إشارة أحمر–أصفر–أخضر مع زر للمشاة. مشروع أول لتعلّم الصمامات والمقاومات والتوقيت والمدخلات.",
    },
    difficulty: { en: "First project", ar: "مشروع أول" },
    parts: [
      { key: "arduino_uno", quantity: 1 },
      { key: "led_red", quantity: 1 },
      { key: "led_green", quantity: 1 },
      { key: "led_rgb", quantity: 1 },
      { key: "resistor_220", quantity: 4 },
      { key: "push_button", quantity: 1 },
      { key: "resistor_10k", quantity: 1 },
    ],
    note: {
      en: "The catalog has no yellow LED, so the RGB LED mixes red and green to show amber.",
      ar: "لا يوجد LED أصفر في الكتالوج، لذا يمزج الـRGB LED الأحمر والأخضر لإظهار اللون الكهرماني.",
    },
    stages: trafficStages.map(buildStage),
  },
  {
    id: "parking-sensor",
    title: { en: "Parking sensor with buzzer", ar: "حساس ركن مع جرس" },
    summary: {
      en: "Measures distance with an ultrasonic sensor and beeps faster as you get closer. The next step after the traffic light.",
      ar: "يقيس المسافة بحساس الموجات فوق الصوتية ويصدر تنبيهاً أسرع كلما اقتربت. الخطوة التالية بعد إشارة المرور.",
    },
    difficulty: { en: "Next step", ar: "الخطوة التالية" },
    parts: [
      { key: "arduino_uno", quantity: 1 },
      { key: "hc_sr04", quantity: 1 },
      { key: "buzzer_active", quantity: 1 },
      { key: "led_green", quantity: 1 },
      { key: "led_red", quantity: 1 },
      { key: "resistor_220", quantity: 2 },
    ],
    stages: parkingStages.map(buildStage),
  },
  {
    id: "irrigation",
    title: { en: "Automatic irrigation", ar: "الري التلقائي حسب رطوبة التربة" },
    summary: {
      en: "Waters a plant when the soil is dry, using a moisture sensor, a relay-switched pump and an LCD.",
      ar: "يروي النبتة عندما تجف التربة باستخدام حساس رطوبة ومضخة عبر ريليه وشاشة LCD.",
    },
    difficulty: { en: "Bigger build", ar: "مشروع أكبر" },
    parts: [
      { key: "arduino_uno", quantity: 1 },
      { key: "soil_moisture", quantity: 1 },
      { key: "relay_5v", quantity: 1 },
      { key: "water_pump_5v", quantity: 1 },
      { key: "lcd1602_i2c", quantity: 1 },
    ],
    stages: irrigationStages.map(buildStage),
  },
];

export const learningProjectById = (id: string) =>
  learningProjects.find((project) => project.id === id) ?? null;

const projectKeywords: Record<LearningProjectId, string[]> = {
  irrigation: ["irrigation", "watering", "soil", "plant", "plants", "ري", "الري", "سقايه", "تربه", "التربه", "نبات", "نباتات", "النبات", "النباتات"],
  "traffic-light": ["traffic light", "traffic lights", "traffic signal", "اشاره مرور", "اشاره المرور", "اشارات المرور", "اشاره ضوئيه"],
  "parking-sensor": ["parking", "parking sensor", "reversing", "ركن", "الركن", "اصطفاف", "الاصطفاف"],
};

/**
 * Maps a free-text description to a written learning path, or null for a generated one.
 * Keywords match whole words only, so "ري" (irrigation) never matches "ريليه" (relay).
 */
export function matchProject(description: string): LearningProjectId | null {
  const text = ` ${normalizeText(description).replace(/[^\p{L}\p{N}]+/gu, " ")} `;
  for (const id of ["parking-sensor", "traffic-light", "irrigation"] as const)
    if (projectKeywords[id].some((keyword) => text.includes(` ${normalizeText(keyword)} `)))
      return id;
  return null;
}

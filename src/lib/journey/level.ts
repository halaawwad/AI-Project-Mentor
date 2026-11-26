import { buildQuestion } from "./projects";
import type { Bi, Level, Question } from "./types";

export const selfRatings: { value: 0 | 1 | 2; label: Bi }[] = [
  { value: 0, label: { en: "I'm new to electronics", ar: "أنا جديد في الإلكترونيات" } },
  { value: 1, label: { en: "I've built a few simple circuits", ar: "بنيت بعض الدوائر البسيطة" } },
  { value: 2, label: { en: "I'm comfortable with sensors and code", ar: "أتعامل بثقة مع الحساسات والبرمجة" } },
];

/** Skill tags match the stage banks, so level-check answers seed the learner's mastery. */
export const levelQuestions: Question[] = [
  buildQuestion("level-1", ["Current limiting", "What does a resistor in series with an LED do?", ["Limits the current", "Raises the voltage", "Makes the LED blink", "Stores data"], "The resistor keeps the LED current at a safe level."], "easy",
    ["ماذا تفعل المقاومة الموصولة على التوالي مع الـLED؟", ["تحدّ من التيار", "ترفع الجهد", "تجعل الـLED يومض", "تخزّن البيانات"], "تُبقي المقاومة تيار الـLED عند مستوى آمن."]),
  buildQuestion("level-2", ["Analog input", "An Arduino Uno analog input such as A0 reads values from…", ["0 to 1023", "0 to 1", "0 to 12", "only HIGH or LOW"], "The Uno converts 0–5 V into 0–1023."], "easy",
    ["يقرأ مدخل تماثلي في Arduino Uno مثل A0 قيماً من…", ["0 إلى 1023", "0 إلى 1", "0 إلى 12", "HIGH أو LOW فقط"], "يحوّل Uno الجهد 0–5 V إلى 0–1023."]),
  buildQuestion("level-3", ["Current limits", "Why is a relay or driver used for a motor or pump?", ["It needs more current than a controller pin can supply", "Motors need Wi-Fi", "To read sensors", "To make it quieter"], "Controller pins can only supply small currents."], "easy",
    ["لماذا نستخدم ريليه أو مشغّلاً (Driver) لمحرك أو مضخة؟", ["لأنه يحتاج تياراً أكبر مما يوفره منفذ وحدة التحكم", "لأن المحركات تحتاج واي فاي", "لقراءة الحساسات", "لجعله أهدأ"], "منافذ وحدة التحكم توفّر تيارات صغيرة فقط."]),
];

export const levelInfo: Record<Level, { title: Bi; path: Bi }> = {
  beginner: {
    title: { en: "Beginner", ar: "مبتدئ" },
    path: {
      en: "Your path starts with an extra Electricity basics stage before the project stages.",
      ar: "يبدأ مسارك بمرحلة إضافية لأساسيات الكهرباء قبل مراحل المشروع.",
    },
  },
  intermediate: {
    title: { en: "Intermediate", ar: "متوسط" },
    path: { en: "Your path goes straight to the project stages.", ar: "ينتقل مسارك مباشرة إلى مراحل المشروع." },
  },
  advanced: {
    title: { en: "Advanced", ar: "متقدم" },
    path: {
      en: "Your path goes straight to the project stages, and you can jump to each stage's quiz.",
      ar: "ينتقل مسارك مباشرة إلى مراحل المشروع، ويمكنك الانتقال إلى اختبار كل مرحلة فوراً.",
    },
  },
};

/**
 * Self-rating (0–2) plus one point per correct answer (0–3) gives 0–5:
 * 0–2 beginner, 3–4 intermediate, 5 advanced.
 */
export function scoreLevel(selfRating: number, answers: (number | null)[]) {
  const correct = levelQuestions.filter((q, i) => answers[i] === q.correct).length;
  const rating = Math.max(0, Math.min(2, Math.floor(selfRating)));
  const score = rating + correct;
  const level: Level = score <= 2 ? "beginner" : score <= 4 ? "intermediate" : "advanced";
  return { score, correct, level };
}

import type { AnswerRecord, Bi, Language, Question, Stage } from "./types";

/** A known misconception: what learners often believe, and the short correction. */
export interface KnownMisconception {
  id: string;
  /** Primary skill tag. */
  skill: string;
  description: Bi;
  correction: Bi;
  /**
   * Wrong options in the local bank that show this misconception, as [question skill, English
   * option text]. Answer records store the English text of local options, so they match exactly.
   */
  matches: [skill: string, option: string][];
}

const m = (
  id: string,
  skill: string,
  description: Bi,
  correction: Bi,
  matches: [string, string][],
): KnownMisconception => ({ id, skill, description, correction, matches });

/** Local, prewritten knowledge base (no AI). */
export const knownMisconceptions: KnownMisconception[] = [
  m("led-polarity-reversed", "LED polarity",
    { en: "Reverses the LED: puts the cathode (short leg, flat edge) on the positive side.", ar: "يعكس الـLED: يضع الكاثود (الطرف القصير، الحافة المسطحة) على الجهة الموجبة." },
    { en: "Current flows from the anode (+, longer leg) to the cathode (−). Reversed, the LED just stays dark.", ar: "يمر التيار من الأنود (+، الطرف الأطول) إلى الكاثود (−). إذا عُكس يبقى الـLED مطفأً فقط." },
    [["LED polarity", "The cathode (shorter leg)"], ["LED polarity", "The cathode (−)"], ["LED polarity", "anode"]]),
  m("led-no-polarity", "LED polarity",
    { en: "Thinks an LED works either way round.", ar: "يظن أن الـLED يعمل بأي اتجاه." },
    { en: "An LED is a diode: it conducts in one direction only, so its orientation matters.", ar: "الـLED صمام ثنائي يمرر التيار في اتجاه واحد فقط، لذا اتجاهه مهم." },
    [["LED polarity", "Either; LEDs have no polarity"], ["LED polarity", "Both are equal"], ["LED polarity", "it lights brighter"]]),
  m("led-no-resistor", "Current limiting",
    { en: "Forgets the current-limiting resistor, or thinks an LED is fine without one.", ar: "ينسى مقاومة تحديد التيار، أو يظن أن الـLED يعمل بأمان دونها." },
    { en: "Every LED needs a series resistor (e.g. 220 Ω at 5 V); without it the current can damage the LED and the pin.", ar: "كل LED يحتاج مقاومة على التوالي (مثل 220 Ω عند 5 V)؛ دونها قد يتلف التيار الـLED والمنفذ." },
    [["Current limiting", "Nothing"], ["Current limiting", "no resistor"], ["Current limiting", "Nowhere"], ["Current limiting", "The LED gets dimmer"]]),
  m("led-shared-resistor", "Current limiting",
    { en: "Thinks one resistor can serve several LEDs or RGB channels.", ar: "يظن أن مقاومة واحدة تكفي لعدة صمامات LED أو قنوات RGB." },
    { en: "Give each LED and each RGB channel its own resistor; shared resistors give uneven brightness.", ar: "أعطِ كل LED وكل قناة RGB مقاومتها الخاصة؛ المقاومة المشتركة تعطي إضاءة غير متساوية." },
    [["Current limiting", "one resistor shared by all"]]),
  m("resistor-raises-voltage", "Current limiting",
    { en: "Thinks a resistor raises or adds voltage instead of limiting current.", ar: "يظن أن المقاومة ترفع الجهد أو تضيفه بدلاً من أن تحدّ من التيار." },
    { en: "A resistor opposes the flow: for the same voltage, less current flows (I = V ÷ R).", ar: "المقاومة تعيق التدفق: عند الجهد نفسه يمر تيار أقل (I = V ÷ R)." },
    [["Current limiting", "Raises the voltage"], ["Resistors", "To raise the voltage"], ["Current", "It adds voltage"]]),
  m("ohms-law-units", "Ohm's law",
    { en: "Mixes up mA and A in Ohm's law, so the answer is off by 10× or 1000×.", ar: "يخلط بين mA وA في قانون أوم، فتكون النتيجة خاطئة بعشرة أضعاف أو ألف ضعف." },
    { en: "Convert milliamps to amps first: 15 mA = 0.015 A, so (5 − 2) ÷ 0.015 = 200 Ω.", ar: "حوّل الملي أمبير إلى أمبير أولاً: 15 mA = 0.015 A، إذن (5 − 2) ÷ 0.015 = 200 Ω." },
    [["Ohm's law", "20 Ω"], ["Ohm's law", "2,000 Ω"], ["Ohm's law", "20,000 Ω"], ["Ohm's law", "1.2 mA"], ["Ohm's law", "120 mA"], ["Ohm's law", "1.4 mA"], ["Ohm's law", "140 mA"], ["Ohm's law", "1.4 A"]]),
  m("ohms-law-formula", "Ohm's law",
    { en: "Uses the wrong form of Ohm's law, or forgets to subtract the LED's voltage.", ar: "يستخدم صيغة خاطئة لقانون أوم، أو ينسى طرح جهد الـLED." },
    { en: "R = (Vsupply − Vled) ÷ I: the resistor drops only the voltage the LED doesn't use.", ar: "R = (Vsupply − Vled) ÷ I: تُسقط المقاومة فقط الجهد الذي لا يستهلكه الـLED." },
    [["Ohm's law", "R = V × I"], ["Ohm's law", "R = I ÷ V"], ["Ohm's law", "R = Vsupply + Vled"]]),
  m("motor-direct-pin", "Current limits",
    { en: "Connects a motor, pump or loud buzzer directly to an Arduino pin.", ar: "يوصل محركاً أو مضخة أو جرساً قوياً مباشرة بمنفذ Arduino." },
    { en: "Pins supply only small currents; drive loads through a relay, transistor or motor driver with a suitable supply.", ar: "المنافذ توفر تيارات صغيرة فقط؛ شغّل الأحمال عبر ريليه أو ترانزستور أو مشغّل محركات مع مصدر تغذية مناسب." },
    [["Current limits", "The A0 pin"], ["Current limits", "connect it to A0"],["Loads", "Directly from a digital pin"], ["Loads", "From an analog input"]]),
  m("relay-nc-no", "Relay contacts",
    { en: "Confuses normally open (NO) and normally closed (NC) relay contacts.", ar: "يخلط بين تلامسات الريليه المفتوحة عادةً (NO) والمغلقة عادةً (NC)." },
    { en: "NO is open while the relay is off and closes when it turns on; use COM + NO for a pump that runs only when switched.", ar: "NO مفتوح والريليه مطفأ ويُغلق عند تشغيله؛ استخدم COM + NO لمضخة تعمل فقط عند التشغيل." },
    [["Relay contacts", "COM and NC (normally closed)"], ["Relay contacts", "closed while the relay is off"], ["Relay contacts", "The pump never runs"]]),
  m("relay-active-low", "Active LOW",
    { en: "Assumes LOW always means off, also on active-LOW relay modules.", ar: "يفترض أن LOW تعني الإطفاء دائماً، حتى في وحدات الريليه من نوع Active LOW." },
    { en: "On active-LOW modules LOW turns the relay on, so write HIGH in setup() to start with it off.", ar: "في وحدات Active LOW تشغّل LOW الريليه، لذا اكتب HIGH في setup() ليبدأ مطفأً." },
    [["Active LOW", "LOW"], ["Active LOW", "broken"]]),
  m("floating-input", "Floating inputs",
    { en: "Thinks an unconnected input pin reads a steady 0.", ar: "يظن أن المدخل غير الموصول يقرأ 0 ثابتاً." },
    { en: "An unconnected input floats and picks up noise; a pull-down resistor or INPUT_PULLUP gives it a defined level.", ar: "المدخل غير الموصول يطفو ويلتقط الضجيج؛ مقاومة Pull-down أو INPUT_PULLUP تعطيه مستوى محدداً." },
    [["Floating inputs", "reads exactly 0"], ["Floating inputs", "the button is broken"], ["Floating inputs", "it's normal"]]),
  m("pullup-inverted", "INPUT_PULLUP",
    { en: "Expects a pressed button to read HIGH with INPUT_PULLUP, or wires it to 5V.", ar: "يتوقع أن يقرأ الزر المضغوط HIGH مع INPUT_PULLUP، أو يوصله بـ5V." },
    { en: "With INPUT_PULLUP the pin rests HIGH; wire the button to GND, so pressed reads LOW.", ar: "مع INPUT_PULLUP يبقى المنفذ HIGH؛ وصّل الزر بـGND فيقرأ LOW عند الضغط." },
    [["INPUT_PULLUP", "HIGH"], ["INPUT_PULLUP", "Between the pin and 5V"]]),
  m("delay-blocking", "Non-blocking timing",
    { en: "Thinks delay() lets the board keep reading buttons or sensors.", ar: "يظن أن delay() تسمح للوحة بمتابعة قراءة الأزرار أو الحساسات." },
    { en: "delay() pauses the whole program; compare millis() with a saved time to keep other code running.", ar: "delay() توقف البرنامج كله؛ قارن millis() بوقت محفوظ ليستمر باقي الكود بالعمل." },
    [["Non-blocking timing", "reads every button"], ["Non-blocking timing", "Nothing"], ["Non-blocking timing", "delay() doesn't exist"]]),
  m("distance-formula", "Distance formula",
    { en: "Converts the echo time wrongly: forgets the round trip (÷ 2) or the speed of sound (÷ 58).", ar: "يحوّل زمن الصدى بشكل خاطئ: ينسى رحلة الذهاب والعودة (÷ 2) أو سرعة الصوت (÷ 58)." },
    { en: "Distance (cm) ≈ echo time (μs) ÷ 58, because the sound goes there and back at about 0.034 cm/μs.", ar: "المسافة (cm) ≈ زمن الصدى (μs) ÷ 58، لأن الصوت يذهب ويعود بسرعة نحو 0.034 cm/μs." },
    [["Distance formula", "5 cm"], ["Distance formula", "58 cm"], ["Distance formula", "580 cm"], ["Distance formula", "116 cm"], ["Distance formula", "2 cm"], ["Distance formula", "The sensor has two 'eyes'"], ["Distance formula", "To convert to inches"], ["Distance formula", "290 μs"], ["Distance formula", "29000 μs"]]),
  m("echo-zero-is-close", "Edge cases",
    { en: "Treats a 0 or timeout reading as 'touching' instead of 'no echo'.", ar: "يعامل القراءة 0 أو انتهاء المهلة على أنها «ملامسة» بدلاً من «لا صدى»." },
    { en: "pulseIn returns 0 when nothing reflects the sound, so treat it as far or out of range.", ar: "تُرجع pulseIn القيمة 0 عندما لا يرتد الصوت، فاعتبرها بعيدة أو خارج المدى." },
    [["Edge cases", "touching"], ["Edge cases", "5 cm"]]),
  m("logic-level-ignored", "Logic levels",
    { en: "Connects 5 V signals straight to 3.3 V-only inputs.", ar: "يوصل إشارات 5 V مباشرة بمداخل تعمل بـ3.3 V فقط." },
    { en: "A 5 V signal can damage a 3.3 V-only input; check the levels and use level shifting.", ar: "إشارة 5 V قد تتلف مدخلاً يعمل بـ3.3 V فقط؛ تحقق من المستويات واستخدم تحويل المستوى." },
    [["Logic levels", "is always fine"], ["Logic levels", "connect it directly"], ["Logic levels", "The Uno ignores voltage"]]),
  m("no-common-ground", "Ground",
    { en: "Thinks connected modules don't need a shared GND.", ar: "يظن أن الوحدات الموصولة لا تحتاج GND مشتركاً." },
    { en: "Signals are measured relative to ground, so every connected part must share GND with the controller.", ar: "تُقاس الإشارات بالنسبة إلى الأرضي، فيجب أن تشترك كل القطع الموصولة في GND مع وحدة التحكم." },
    [["Ground", "Nothing else"], ["Ground", "nothing"], ["Ground", "The same USB cable"], ["Common ground", "Nothing"], ["Common ground", "The same USB cable"]]),
  m("open-circuit", "Closed circuits",
    { en: "Thinks current can flow without a complete loop back to GND.", ar: "يظن أن التيار يمكن أن يمر دون حلقة كاملة تعود إلى GND." },
    { en: "Current needs a closed loop: supply → parts → back to GND.", ar: "يحتاج التيار حلقة مغلقة: المصدر ← القطع ← العودة إلى GND." },
    [["Closed circuits", "5V → LED anode only"], ["Closed circuits", "The LED needs a faster controller"], ["Closed circuits", "a switch is turned off"]]),
  m("buzzer-active-passive", "Active vs passive",
    { en: "Mixes up active and passive buzzers (e.g. thinks every buzzer needs tone()).", ar: "يخلط بين الجرس النشط وغير النشط (مثلاً يظن أن كل جرس يحتاج tone())." },
    { en: "An active buzzer beeps with plain HIGH/LOW; a passive one needs a changing signal such as tone().", ar: "الجرس النشط يصدر صوتاً بـHIGH/LOW فقط؛ أما غير النشط فيحتاج إشارة متغيرة مثل tone()." },
    [["Active vs passive", "is required"], ["Active vs passive", "An active buzzer with HIGH/LOW"], ["Active vs passive", "no signal at all"]]),
  m("adc-range", "ADC range",
    { en: "Thinks analogRead returns 0–255, 0–1 or a voltage directly.", ar: "يظن أن analogRead تُرجع 0–255 أو 0–1 أو الجهد مباشرة." },
    { en: "On the Uno, analogRead returns 0–1023 for 0–5 V.", ar: "في Uno تُرجع analogRead القيم 0–1023 للجهد 0–5 V." },
    [["ADC range", "0–255"], ["ADC range", "0–5000"], ["ADC range", "0–1"]]),
  m("single-threshold", "Hysteresis",
    { en: "Thinks one threshold is enough and doesn't expect switching around it.", ar: "يظن أن عتبة واحدة تكفي ولا يتوقع التبديل المتكرر حولها." },
    { en: "Use two thresholds (start and stop); between them the pump keeps its current state.", ar: "استخدم عتبتين (بدء وإيقاف)؛ بينهما تحافظ المضخة على حالتها الحالية." },
    [["Hysteresis", "It turns off immediately"], ["Hysteresis", "The pump stays off"], ["Hysteresis", "Nothing"]]),
];

const key = (skill: string, option: string) => `${skill}\u0000${option}`;
const index = new Map<string, KnownMisconception>();
for (const item of knownMisconceptions) for (const [skill, option] of item.matches) index.set(key(skill, option), item);

export const misconceptionById = (id: string) => knownMisconceptions.find((item) => item.id === id) ?? null;

/** The known misconception behind a wrong option of a question with this skill, if any. */
export const misconceptionForOption = (skill: string, option: string) => index.get(key(skill, option)) ?? null;

/** The known misconception behind a wrong answer record (null for right answers or unmapped ones). */
export const misconceptionForRecord = (record: AnswerRecord) =>
  record.isCorrect || !record.chosen ? null : misconceptionForOption(record.skill, record.chosen);

/** Misconception IDs mapped to each wrong option of a question (by option index). */
export const questionMisconceptions = (question: Question) =>
  question.options.map((option, i) => (i === question.correct ? null : (misconceptionForOption(question.skill, option)?.id ?? null)));

export interface RetrievedMisconception {
  misconception: KnownMisconception;
  /** Wrong answers that matched it exactly. 0 means it is related only by skill. */
  matched: number;
}

/**
 * Local retrieval for Gemini requests: only misconceptions related to the learner's recent wrong
 * answers. Exact matches (the chosen wrong option maps to it) come first, ordered by how often;
 * then, for wrong answers with no exact match (e.g. Gemini questions), misconceptions with the
 * same skill. `skills` limits the result to the skills a request may use.
 */
export function retrieveMisconceptions(
  records: AnswerRecord[],
  { skills, limit = 4, recent = 20 }: { skills?: string[]; limit?: number; recent?: number } = {},
): RetrievedMisconception[] {
  const allowed = skills ? new Set(skills) : null;
  const wrong = records.slice(0, recent).filter((r) => !r.isCorrect && (!allowed || allowed.has(r.skill)));
  const counts = new Map<string, number>();
  const unmatchedSkills: string[] = [];
  for (const record of wrong) {
    const found = misconceptionForRecord(record);
    if (found) counts.set(found.id, (counts.get(found.id) ?? 0) + 1);
    else if (!unmatchedSkills.includes(record.skill)) unmatchedSkills.push(record.skill);
  }
  const exact = [...counts]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([id, matched]) => ({ misconception: misconceptionById(id)!, matched }));
  const related = unmatchedSkills
    .flatMap((skill) => knownMisconceptions.filter((k) => k.skill === skill && !counts.has(k.id)).slice(0, 1))
    .map((misconception) => ({ misconception, matched: 0 }));
  return [...exact, ...related].slice(0, limit);
}

/** Compact prompt lines (English; Gemini writes its answer in the requested language). */
export function formatMisconceptions(list: RetrievedMisconception[]) {
  return list
    .map(
      ({ misconception: k, matched }) =>
        `- [${k.id}] (${k.skill}) ${k.description.en} Correction: ${k.correction.en} ${matched ? `(matches ${matched} recent wrong answer${matched > 1 ? "s" : ""})` : "(related by skill)"}`,
    )
    .join("\n");
}

/**
 * Few-shot examples: up to `count` local bank questions on the given skills (one per skill first),
 * preferring questions the learner has already seen, so copying one is rejected as a repeat.
 */
export function exampleQuestions(stages: Stage[], skills: string[], seen: Set<string> = new Set(), count = 3): Question[] {
  const pool = stages.flatMap((s) => s.bank).filter((q) => skills.includes(q.skill));
  const ranked = [...pool].sort((a, b) => Number(seen.has(b.id)) - Number(seen.has(a.id)));
  const chosen: Question[] = [];
  for (const skill of skills) {
    const q = ranked.find((c) => c.skill === skill && !chosen.includes(c));
    if (q && chosen.length < count) chosen.push(q);
  }
  for (const q of ranked) if (chosen.length < count && !chosen.includes(q)) chosen.push(q);
  return chosen;
}

export function formatExampleQuestions(questions: Question[]) {
  return questions
    .map(
      (q) =>
        `- [${q.skill} · ${q.difficulty}] ${q.prompt} | options: ${q.options.join(" / ")} | correct: ${q.options[q.correct]} | why: ${q.explanation}`,
    )
    .join("\n");
}

/** One short example diagnosis, to guide format, tone and grounding (not this learner's data). */
export const EXAMPLE_DIAGNOSIS = JSON.stringify({
  strengths: ["Digital outputs"],
  weakSkills: ["LED polarity"],
  misconceptions: [{ skill: "LED polarity", text: "Puts the LED's short leg (cathode) on the positive side, so it stays dark." }],
  confidence: "low",
  confidenceNote: "Only 4 answers so far.",
});

/** Text for a known misconception in the requested language. */
export const misconceptionText = (k: KnownMisconception, language: Language) => ({
  description: k.description[language],
  correction: k.correction[language],
});

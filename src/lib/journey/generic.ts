import {
  catalogByKey,
  catalogCategories,
  catalogCategoryLabels,
  categoryLabel,
  type CatalogComponent,
} from "@/lib/componentCatalog";
import type { PinDef, PinKind } from "@/lib/lab/catalog";
import { connectionGuide, explainPin } from "@/lib/componentSheets";
import { shortFunction } from "@/lib/suggest/catalogContext";
import type { RawQuestion } from "./content";
import { buildQuestion } from "./projects";
import { seededShuffle } from "./random";
import type { Bi, Difficulty, ProjectPart, Question, Quiz, Stage } from "./types";

const QUESTIONS_PER_QUIZ = 5;
/** Inputs that the catalog files under "electronic parts". */
const INPUT_KEYS = new Set(["push_button", "potentiometer_10k", "ldr"]);
const cat = (item: CatalogComponent) => catalogCategories.indexOf(item.category);

const groups: { id: string; title: Bi; match: (item: CatalogComponent) => boolean }[] = [
  { id: "controller", title: { en: "Meet your controller", ar: "تعرّف على وحدة التحكم" }, match: (i) => cat(i) === 0 },
  { id: "inputs", title: { en: "Reading inputs and sensors", ar: "قراءة المدخلات والحساسات" }, match: (i) => cat(i) === 1 || cat(i) === 7 || INPUT_KEYS.has(i.key) },
  { id: "outputs", title: { en: "Driving outputs", ar: "تشغيل المخرجات" }, match: (i) => [2, 3, 4].includes(cat(i)) && !INPUT_KEYS.has(i.key) },
  { id: "power", title: { en: "Driving motors and loads safely", ar: "تشغيل المحركات والأحمال بأمان" }, match: (i) => cat(i) === 5 },
  { id: "comms", title: { en: "Wireless communication", ar: "الاتصال اللاسلكي" }, match: (i) => cat(i) === 6 },
];

/** General wiring questions used to complete generated quizzes (first option is correct). */
const generalQuestions: RawQuestion[] = [
  ["Common ground", "When a controller and a module exchange signals, what must they share?", ["A common ground (GND)", "The same USB cable", "The same wire colour", "Nothing"], "Signals are measured relative to ground, so connected parts need a shared GND."],
  ["Logic levels", "Before connecting a 5 V module's output to a 3.3 V board's input, you should…", ["check the levels and use level shifting if needed", "connect it directly", "add a second GND only", "use a longer wire"], "A 5 V signal can damage a 3.3 V-only input."],
  ["Datasheets", "Why check the datasheet for your exact part number?", ["Pin order and limits can differ between variants", "Datasheets are only decoration", "All parts with the same name are identical", "It isn't needed for small parts"], "The catalog map is functional; your exact variant decides the details."],
  ["Wiring safety", "What should you do before changing the wiring?", ["Disconnect power", "Leave power on to test faster", "Remove GND only", "Press RESET repeatedly"], "Rewiring a powered circuit risks shorts."],
  ["Loads", "How should a motor or pump be driven from a controller?", ["Through a driver or relay with a suitable supply", "Directly from a digital pin", "From an analog input", "Through the I²C pins"], "Controller pins can't supply motor currents."],
  ["Current limiting", "What does an LED need in series to protect it and the pin?", ["A current-limiting resistor", "A relay", "A second LED", "Nothing"], "The resistor sets a safe current."],
];

const voltageOptions = ["3.3 V", "5 V", "12 V", "Circuit-dependent"];
const kindPool: PinKind[] = ["power", "ground", "sda", "tx", "motor", "analog", "pwm", "passive", "digital"];
const uniqueNames = (pins: PinDef[]) => [...new Set(pins.map((p) => p.name))];

/** Part-specific questions built only from catalog data (first option is correct). */
function partQuestions(item: CatalogComponent, seed: string): RawQuestion[] {
  const questions: RawQuestion[] = [];
  const supply = item.voltage ? `${item.voltage} V` : "Circuit-dependent";
  questions.push([
    "Power requirements",
    `What typical supply does the catalog list for the ${item.name}?`,
    [supply, ...voltageOptions.filter((v) => v !== supply)].slice(0, 4) as RawQuestion[2],
    item.voltage
      ? `The catalog lists a typical ${item.voltage} V supply; check your exact variant.`
      : "Its supply depends on the circuit it's used in.",
  ]);
  const label = categoryLabel(item.category);
  questions.push([
    "Part categories",
    `Which category does the ${item.name} belong to?`,
    [label, ...seededShuffle(catalogCategoryLabels.filter((l) => l !== label), `${seed}-cat`).slice(0, 3)] as RawQuestion[2],
    `It's listed under ${label}: ${shortFunction(item)}.`,
  ]);
  const grounds = item.def.pins.filter((p) => p.kind === "ground");
  const others = uniqueNames(item.def.pins.filter((p) => p.kind !== "ground"));
  if (grounds.length && others.length >= 3)
    questions.push([
      "Ground connections",
      `Which terminal of the ${item.name} is a ground (GND) connection?`,
      [grounds[0]!.name, ...seededShuffle(others, `${seed}-gnd`).slice(0, 3)] as RawQuestion[2],
      `${grounds[0]!.name} is the ground terminal; connect it to the controller's GND.`,
    ]);
  const signals = item.def.pins.filter((p) => p.kind !== "power" && p.kind !== "ground");
  const pin = seededShuffle(signals, `${seed}-pin`)[0];
  if (pin) {
    const correct = explainPin(pin);
    const distractors = seededShuffle(kindPool.filter((k) => k !== pin.kind), `${seed}-kinds`)
      .map((kind) => explainPin({ name: "X", kind, dir: "io" }))
      .filter((text, i, all) => text !== correct && all.indexOf(text) === i)
      .slice(0, 3);
    if (distractors.length === 3)
      questions.push([
        "Pin functions",
        `On the ${item.name}, what is the ${pin.name} terminal for?`,
        [correct, ...distractors] as RawQuestion[2],
        `${pin.name}: ${correct}`,
      ]);
  }
  return questions;
}

function generatedQuiz(stageId: string, version: number, items: CatalogComponent[]): Quiz {
  const id = `${stageId}-${version === 0 ? "a" : "b"}`;
  const specific = seededShuffle(
    items.flatMap((item) => partQuestions(item, `${id}-${item.key}`)),
    `${id}-specific`,
  );
  const general = seededShuffle(generalQuestions, `${id}-general`);
  // Mostly part-specific questions, always topped up with general ones to reach five.
  const chosen = [...specific.slice(0, QUESTIONS_PER_QUIZ - 1), ...general].slice(0, QUESTIONS_PER_QUIZ);
  const questions: Question[] = chosen.map((raw, i) => buildQuestion(`${id}-${i + 1}`, raw, difficultyOf(raw)));
  return { id, questions };
}

/** Generated questions get a difficulty from their kind. */
const skillDifficulty: Record<string, Difficulty> = {
  "Power requirements": "easy",
  "Part categories": "easy",
  "Ground connections": "medium",
  "Pin functions": "hard",
};
const difficultyOf = (raw: RawQuestion): Difficulty => skillDifficulty[raw[0]] ?? "medium";

/** Every part-specific and general question for the stage, without duplicate prompts. */
function generatedBank(stageId: string, items: CatalogComponent[]): Question[] {
  const raws = [
    ...items.flatMap((item) => [0, 1].flatMap((v) => partQuestions(item, `${stageId}-${v === 0 ? "a" : "b"}-${item.key}`))),
    ...generalQuestions,
  ];
  const seen = new Set<string>();
  return raws
    .filter((raw) => !seen.has(raw[1]) && seen.add(raw[1]))
    .map((raw, i) => buildQuestion(`${stageId}-k-${i + 1}`, raw, difficultyOf(raw)));
}

function practiceTask(items: CatalogComponent[]) {
  for (const item of items) {
    const ground = item.def.pins.find((p) => p.kind === "ground");
    const power = item.def.pins.find((p) => p.kind === "power");
    if (ground && power)
      return `In the 3D Lab, place the ${item.name}, connect its ${power.name} to ${item.voltage === 3.3 ? "3V3" : "5V"} and its ${ground.name} to GND, then run Validate Wiring.`;
  }
  return `In the 3D Lab, place the ${items[0]?.name ?? "part"}, connect it to the controller following its connection sheet, then run Validate Wiring.`;
}

function generatedStage(id: string, title: Bi, items: CatalogComponent[]): Stage {
  const names = items.map((item) => item.name).join(", ");
  const guides = items.slice(0, 3).map((item) => connectionGuide(item).intro);
  return {
    id,
    title,
    goal: `Understand what the ${names} do in your project and how to connect them safely.`,
    explanation: [
      ...guides,
      ...items.map((item) => `${item.name}: ${shortFunction(item)}.`),
      "Identify each terminal by its printed name, give each part the supply its datasheet specifies, and share ground with the controller.",
    ].join(" "),
    parts: items.map((item) => item.key),
    mentor: {
      alternative: `Think of each part as a team member with one job. ${items
        .slice(0, 3)
        .map((item) => `The ${item.name} is in ${categoryLabel(item.category).toLowerCase()}: ${shortFunction(item)}.`)
        .join(" ")} Every member needs power, a shared ground, and a clear signal line to the controller.`,
      practiceTask: practiceTask(items),
    },
    quizzes: [generatedQuiz(id, 0, items), generatedQuiz(id, 1, items)],
    bank: generatedBank(id, items),
    source: "generated",
  };
}

/**
 * Builds a path for any approved parts list: one stage per non-empty group, then a final
 * "wiring it together" stage. Content comes only from catalog and component-sheet data.
 */
export function buildGenericPath(parts: ProjectPart[]): Stage[] {
  const items = [...new Set(parts.map((p) => p.key))]
    .map((key) => catalogByKey.get(key))
    .filter((item): item is CatalogComponent => Boolean(item));
  if (!items.length) return [];
  const stages = groups
    .map((group) => ({ group, members: items.filter(group.match) }))
    .filter(({ members }) => members.length)
    .map(({ group, members }) => generatedStage(`generic-${group.id}`, group.title, members));
  stages.push(
    generatedStage("generic-together", { en: "Wiring it all together", ar: "توصيل كل شيء معاً" }, items),
  );
  return stages;
}

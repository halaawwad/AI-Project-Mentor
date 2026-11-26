import type { CatalogComponent } from "@/lib/componentCatalog";
import type { PinDef, PinKind } from "@/lib/lab/catalog";
import type { Language, Question, Stage } from "./types";

/** Arabic names for skill tags. The tags themselves stay English (grading, mastery, Gemini). */
export const skillLabelsAr: Record<string, string> = {
  Voltage: "الجهد",
  "Closed circuits": "الدوائر المغلقة",
  Ground: "الأرضي (GND)",
  Breadboards: "لوحة التجارب (Breadboard)",
  "Controller pins": "منافذ وحدة التحكم",
  Current: "التيار",
  Resistors: "المقاومات",
  "Analog input": "المدخل التماثلي",
  "ADC range": "مدى المحوّل التماثلي (ADC)",
  Calibration: "المعايرة",
  "Digital output": "الخرج الرقمي (DO)",
  "Powering sensors": "تغذية الحساسات",
  "Current limits": "حدود التيار",
  "Relay basics": "أساسيات الريليه",
  "Relay contacts": "تلامسات الريليه",
  "Control signal": "إشارة التحكم",
  "Active LOW": "منطق Active LOW",
  "Wiring safety": "سلامة التوصيل",
  Hysteresis: "العتبتان (Hysteresis)",
  "I²C wiring": "توصيل I²C",
  "I²C address": "عنوان I²C",
  "Fail-safe logic": "منطق الأمان",
  "Program loop": "حلقة البرنامج",
  Display: "العرض على الشاشة",
  "LED polarity": "قطبية الـLED",
  "Current limiting": "تحديد التيار",
  "Ohm's law": "قانون أوم",
  "Colour mixing": "مزج الألوان",
  "Digital outputs": "المخارج الرقمية",
  "Light sequence": "تسلسل الإشارة",
  "Non-blocking timing": "التوقيت دون تعطيل (millis)",
  "State machines": "آلة الحالات",
  "Floating inputs": "المداخل العائمة",
  "Pull-down resistors": "مقاومات Pull-down",
  INPUT_PULLUP: "INPUT_PULLUP",
  Debouncing: "معالجة الارتداد (Debouncing)",
  "Digital inputs": "المداخل الرقمية",
  Triggering: "نبضة التشغيل (TRIG)",
  "Echo timing": "زمن الصدى (ECHO)",
  "Distance formula": "معادلة المسافة",
  "Logic levels": "مستويات الجهد المنطقي",
  "Sensor range": "مدى الحساس",
  "Active buzzers": "الجرس النشط",
  "Active vs passive": "الجرس النشط وغير النشط",
  Polarity: "القطبية",
  "Warning design": "تصميم التحذير",
  "Mapping values": "تحويل القيم",
  Thresholds: "العتبات",
  "Noisy readings": "القراءات المتقلبة",
  "Edge cases": "الحالات الخاصة",
  "Power requirements": "متطلبات التغذية",
  "Part categories": "فئات القطع",
  "Ground connections": "توصيلات الأرضي (GND)",
  "Pin functions": "وظائف الأطراف",
  "Common ground": "الأرضي المشترك",
  Datasheets: "الـDatasheet",
  Loads: "الأحمال",
};

export const skillLabel = (skill: string, language: Language) =>
  language === "ar" ? (skillLabelsAr[skill] ?? skill) : skill;

/** Question text in the requested language; Gemini questions are already in one language. */
export function questionText(question: Question, language: Language) {
  return language === "ar" && question.ar
    ? question.ar
    : { prompt: question.prompt, options: question.options, explanation: question.explanation };
}

export const hasArabic = (text: string) => /[؀-ۿ]/.test(text);
/** Direction for a question: RTL when the text shown is Arabic. */
export const questionDir = (question: Question, language: Language) =>
  hasArabic(questionText(question, language).prompt) ? "rtl" : "ltr";

/** Stage lesson text in the requested language. */
export function stageText(stage: Stage, language: Language) {
  return language === "ar"
    ? { goal: stage.ar.goal, explanation: stage.ar.explanation, mentor: stage.ar.mentor }
    : { goal: stage.goal, explanation: stage.explanation, mentor: stage.mentor };
}

const labCategoryAr: Record<string, string> = {
  Microcontrollers: "وحدة تحكم",
  Sensors: "حساس",
  Actuators: "مشغّل أو محرك",
  "Displays & LEDs": "شاشات وصمامات LED",
  "Passive & Input": "عناصر سلبية ومداخل",
  "Motor Drivers": "مشغّل محركات",
  Wireless: "اتصال لاسلكي",
};
const interfaceNamesAr: Partial<Record<PinKind, string>> = {
  digital: "مداخل ومخارج رقمية",
  analog: "تماثلي",
  pwm: "PWM",
  sda: "I2C",
  scl: "I2C",
  tx: "UART",
  rx: "UART",
  spi: "SPI/تحكم تسلسلي",
  motor: "خرج محرك/حمل",
  passive: "أطراف سلبية",
};

/** Arabic version of `shortFunction`: lab category plus pin interfaces. */
export function shortFunctionAr(item: CatalogComponent) {
  const interfaces = [...new Set(item.def.pins.map((pin) => interfaceNamesAr[pin.kind]).filter(Boolean))];
  const category = labCategoryAr[item.def.category] ?? item.def.category;
  return interfaces.length ? `${category}؛ الواجهات: ${interfaces.join("، ")}` : category;
}

/** Arabic version of `explainPin` (componentSheets), with the same rules in the same order. */
export function explainPinAr(pin: PinDef) {
  const name = pin.name;
  if (pin.functions) return `الوظائف في الكتالوج: ${pin.functions}`;
  if (name === "TRIG") return "مدخل نبضة التشغيل؛ تبدأ وحدة التحكم القياس من هنا.";
  if (name === "ECHO") return "خرج نبضة الصدى؛ تقيس وحدة التحكم مدتها.";
  if (name === "ANODE") return "الطرف الموجب للـLED؛ يوصل عبر مقاومة تحديد التيار.";
  if (name === "CATHODE") return "الطرف السالب للـLED؛ مسار العودة نحو الأرضي.";
  if (pin.kind === "ground") return "أرضي / مسار العودة المرجعي؛ شاركه مع دائرة التحكم الموصولة.";
  if (pin.kind === "power") return "طرف تغذية؛ اسمه ونسخة اللوحة يحددان إن كان مدخل تغذية أو خرجاً.";
  if (pin.kind === "sda") return "خط بيانات I²C؛ يوصل بـSDA في وحدة التحكم بمستوى جهد منطقي متوافق.";
  if (pin.kind === "scl") return "خط ساعة I²C؛ يوصل بـSCL في وحدة التحكم بمستوى جهد منطقي متوافق.";
  if (pin.kind === "tx") return "إرسال UART؛ يوصل عادةً بمدخل الاستقبال في الجهاز الآخر.";
  if (pin.kind === "rx") return "استقبال UART؛ يوصل عادةً بخرج الإرسال في الجهاز الآخر.";
  if (pin.kind === "motor") return "توصيل حمل أو محرك؛ اتبع مخطط توصيل المشغّل لتوزيع الملفات أو القنوات.";
  if (pin.kind === "spi") return "واجهة تسلسلية / إشارة تحكم؛ طابِق اسم الإشارة المطبوع والبروتوكول مع وحدة التحكم.";
  if (pin.kind === "analog") return "طرف إشارة تماثلية؛ تحقّق من اتجاه الإشارة والجهد المسموح لهذه القطعة.";
  if (pin.kind === "pwm") return "منفذ رقمي يدعم PWM في نموذج الكتالوج.";
  if (pin.kind === "passive") return "طرف سلبي؛ يعتمد دوره على الدائرة ونسخة القطعة.";
  return "إشارة تحكم / رقمية؛ تحقّق من الوظيفة المسمّاة قبل التوصيل.";
}

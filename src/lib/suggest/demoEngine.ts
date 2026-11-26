import { findExample } from "./examples";
import { detectLanguage, normalizeText } from "./language";
import { mergeSuggestions } from "./validate";
import type { PartSuggestion, SuggestionLanguage } from "./types";

type Text = { en: string; ar: string };
interface KeywordRule {
  key: string;
  quantity?: number;
  keywords: string[];
  role: Text;
  reason: Text;
}

/** Keyword → catalog part rules for the local demo engine (English and Arabic keywords). */
const rules: KeywordRule[] = [
  { key: "hc_sr04", keywords: ["distance", "ultrasonic", "obstacle", "parking", "مسافه", "عوائق", "عائق", "اصطدام", "فوق الصوتيه"], role: { en: "Measures distance to nearby objects.", ar: "يقيس المسافة إلى الأجسام القريبة." }, reason: { en: "Your description mentions distance or obstacles.", ar: "وصفك يذكر المسافة أو العوائق." } },
  { key: "dht22", keywords: ["temperature", "humidity", "weather", "climate", "حراره", "رطوبه", "طقس"], role: { en: "Measures temperature and humidity.", ar: "يقيس درجة الحرارة والرطوبة." }, reason: { en: "Your description mentions temperature, humidity or weather.", ar: "وصفك يذكر الحرارة أو الرطوبة أو الطقس." } },
  { key: "soil_moisture", keywords: ["soil", "plant", "irrigation", "watering", "garden", "تربه", "نبات", "الري", "زراعه", "حديقه"], role: { en: "Measures how wet the soil is.", ar: "يقيس رطوبة التربة." }, reason: { en: "Your description mentions plants, soil or watering.", ar: "وصفك يذكر النباتات أو التربة أو الري." } },
  { key: "water_pump_5v", keywords: ["pump", "watering", "irrigation", "مضخه", "سقايه"], role: { en: "Moves water.", ar: "تضخ الماء." }, reason: { en: "Your description mentions pumping or watering.", ar: "وصفك يذكر الضخ أو السقاية." } },
  { key: "pir_hc_sr501", keywords: ["motion", "pir", "intruder", "security", "حركه", "متسلل", "سرقه", "امان"], role: { en: "Detects people moving nearby.", ar: "يكتشف حركة الأشخاص القريبين." }, reason: { en: "Your description mentions motion or security.", ar: "وصفك يذكر الحركة أو الأمان." } },
  { key: "ldr_module", keywords: ["light sensor", "light level", "brightness", "darkness", "street light", "شده الضوء", "ظلام", "ليلا"], role: { en: "Senses how bright it is.", ar: "يستشعر شدة الإضاءة." }, reason: { en: "Your description mentions light level or darkness.", ar: "وصفك يذكر شدة الضوء أو الظلام." } },
  { key: "flame_sensor", keywords: ["fire", "flame", "حريق", "لهب"], role: { en: "Detects a flame.", ar: "يكتشف اللهب." }, reason: { en: "Your description mentions fire or flame.", ar: "وصفك يذكر الحريق أو اللهب." } },
  { key: "mq2_gas", keywords: ["gas", "smoke", "غاز", "دخان"], role: { en: "Detects gas or smoke.", ar: "يكتشف الغاز أو الدخان." }, reason: { en: "Your description mentions gas or smoke.", ar: "وصفك يذكر الغاز أو الدخان." } },
  { key: "water_level", keywords: ["water level", "tank", "flood", "مستوى الماء", "خزان", "فيضان"], role: { en: "Senses the water level.", ar: "يستشعر مستوى الماء." }, reason: { en: "Your description mentions a water level or tank.", ar: "وصفك يذكر مستوى الماء أو الخزان." } },
  { key: "mpu6050", keywords: ["tilt", "acceleration", "gyro", "balance", "fall detect", "ميلان", "تسارع", "توازن", "سقوط"], role: { en: "Measures tilt and acceleration.", ar: "يقيس الميلان والتسارع." }, reason: { en: "Your description mentions tilt, balance or movement sensing.", ar: "وصفك يذكر الميلان أو التوازن أو استشعار الحركة." } },
  { key: "bmp280", keywords: ["pressure", "altitude", "ضغط جوي", "الضغط الجوي", "ارتفاع"], role: { en: "Measures air pressure.", ar: "يقيس الضغط الجوي." }, reason: { en: "Your description mentions pressure or altitude.", ar: "وصفك يذكر الضغط أو الارتفاع." } },
  { key: "ir_obstacle", keywords: ["line follow", "infrared", "تتبع الخط", "تحت الحمراء"], role: { en: "Detects nearby surfaces with infrared.", ar: "يكتشف الأسطح القريبة بالأشعة تحت الحمراء." }, reason: { en: "Your description mentions infrared or line following.", ar: "وصفك يذكر الأشعة تحت الحمراء أو تتبع الخط." } },
  { key: "push_button", keywords: ["button", "زر"], role: { en: "Lets the user give a command.", ar: "يتيح للمستخدم إعطاء أمر." }, reason: { en: "Your description mentions a button.", ar: "وصفك يذكر زراً." } },
  { key: "potentiometer_10k", keywords: ["knob", "potentiometer", "مقاومه متغيره"], role: { en: "Lets the user set a value by turning a knob.", ar: "تتيح ضبط قيمة بتدوير مقبض." }, reason: { en: "Your description mentions a knob or adjustable value.", ar: "وصفك يذكر مقبضاً أو قيمة قابلة للضبط." } },
  { key: "servo_sg90", keywords: ["servo", "door", "gate", "arm", "سيرفو", "باب", "بوابه", "ذراع"], role: { en: "Moves to a set angle.", ar: "يتحرك إلى زاوية محددة." }, reason: { en: "Your description mentions a door, gate, arm or servo.", ar: "وصفك يذكر باباً أو بوابة أو ذراعاً أو سيرفو." } },
  { key: "dc_motor", quantity: 2, keywords: ["dc motor", "wheel", "robot car", "car", "fan", "سياره", "عجلات", "مروحه"], role: { en: "Turns wheels or a fan.", ar: "يدير العجلات أو المروحة." }, reason: { en: "Your description mentions wheels, a car or a fan.", ar: "وصفك يذكر عجلات أو سيارة أو مروحة." } },
  { key: "stepper_28byj48", keywords: ["stepper", "محرك خطوي"], role: { en: "Rotates in precise steps.", ar: "يدور بخطوات دقيقة." }, reason: { en: "Your description mentions a stepper motor.", ar: "وصفك يذكر محركاً خطوياً." } },
  { key: "buzzer_active", keywords: ["buzzer", "alarm", "beep", "sound", "جرس", "انذار", "تنبيه", "صوت"], role: { en: "Makes an alert sound.", ar: "يصدر صوت تنبيه." }, reason: { en: "Your description mentions an alarm or sound.", ar: "وصفك يذكر إنذاراً أو صوتاً." } },
  { key: "relay_5v", keywords: ["relay", "lamp", "appliance", "ريليه", "مرحل", "مصباح"], role: { en: "Switches a higher-power load.", ar: "يشغّل حملاً أعلى قدرة." }, reason: { en: "Your description mentions switching a lamp, appliance or load.", ar: "وصفك يذكر تشغيل مصباح أو جهاز أو حمل." } },
  { key: "lcd1602_i2c", keywords: ["lcd", "display", "screen", "شاشه", "عرض"], role: { en: "Shows text and readings.", ar: "تعرض النصوص والقراءات." }, reason: { en: "Your description mentions a display or screen.", ar: "وصفك يذكر شاشة أو عرضاً." } },
  { key: "seven_segment_1digit", keywords: ["seven segment", "7 segment", "digit", "counter", "عداد"], role: { en: "Shows a single digit.", ar: "تعرض رقماً واحداً." }, reason: { en: "Your description mentions a digit or counter.", ar: "وصفك يذكر رقماً أو عداداً." } },
  { key: "led_red", keywords: ["led", "indicator", "warning light", "red light", "ليد", "مؤشر", "ضوء احمر", "ضوءا احمر"], role: { en: "Lights up as an indicator.", ar: "يضيء كمؤشر." }, reason: { en: "Your description mentions an LED, indicator or light.", ar: "وصفك يذكر صماماً أو مؤشراً أو ضوءاً." } },
  { key: "led_rgb", keywords: ["rgb", "colour", "color", "الوان", "ملون"], role: { en: "Shows different colours.", ar: "يعرض ألواناً مختلفة." }, reason: { en: "Your description mentions colours.", ar: "وصفك يذكر الألوان." } },
  { key: "rfid_rc522", keywords: ["rfid", "nfc", "card", "access", "بطاقه"], role: { en: "Reads RFID cards or tags.", ar: "يقرأ بطاقات RFID." }, reason: { en: "Your description mentions cards or access control.", ar: "وصفك يذكر البطاقات أو التحكم بالدخول." } },
  { key: "hc05_bluetooth", keywords: ["bluetooth", "بلوتوث"], role: { en: "Talks to a phone over Bluetooth.", ar: "يتصل بالهاتف عبر البلوتوث." }, reason: { en: "Your description mentions Bluetooth.", ar: "وصفك يذكر البلوتوث." } },
  { key: "nrf24l01", keywords: ["radio", "nrf24", "remote control", "لاسلكي", "راديو"], role: { en: "Sends data by radio between boards.", ar: "يرسل البيانات لاسلكياً بين اللوحات." }, reason: { en: "Your description mentions a radio or wireless link.", ar: "وصفك يذكر اتصالاً لاسلكياً." } },
];

const controllers: { key: string; keywords: string[] }[] = [
  { key: "esp32_devkit_v1", keywords: ["esp32", "wifi", "wi-fi", "internet", "iot", "cloud", "واي فاي", "انترنت", "الانترنت"] },
  { key: "raspberry_pi_4", keywords: ["raspberry", "camera", "راسبيري", "كاميرا"] },
  { key: "arduino_nano", keywords: ["nano", "نانو"] },
];

const controllerText = {
  role: { en: "Main controller that runs the project logic.", ar: "وحدة التحكم الرئيسية التي تشغّل منطق المشروع." },
  reason: { en: "Every listed sensor and output needs a controller to read or drive it.", ar: "كل حساس ومخرج في القائمة يحتاج وحدة تحكم لقراءته أو تشغيله." },
};

/** Supporting parts the matched parts need to be wired safely. */
const companions: { when: string; key: string; role: Text; reason: Text }[] = [
  { when: "led_red", key: "resistor_220", role: { en: "Limits the LED current.", ar: "تحدّ من تيار صمام LED." }, reason: { en: "An LED needs a series resistor.", ar: "صمام LED يحتاج مقاومة على التوالي." } },
  { when: "dc_motor", key: "l298n", role: { en: "Drives the DC motors.", ar: "يشغّل محركات التيار المستمر." }, reason: { en: "Motors need more current than a controller pin can supply.", ar: "المحركات تحتاج تياراً أكبر مما يوفره منفذ وحدة التحكم." } },
  { when: "stepper_28byj48", key: "uln2003", role: { en: "Drives the stepper motor coils.", ar: "يشغّل ملفات المحرك الخطوي." }, reason: { en: "A stepper motor needs a driver board.", ar: "المحرك الخطوي يحتاج لوحة تشغيل." } },
  { when: "water_pump_5v", key: "relay_5v", role: { en: "Switches the pump on and off.", ar: "يشغّل المضخة ويطفئها." }, reason: { en: "A controller pin cannot power a pump directly.", ar: "منفذ وحدة التحكم لا يستطيع تشغيل المضخة مباشرة." } },
];

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const patterns = new Map<string, RegExp>();
/**
 * English keywords match whole words (optional plural "s"/"es"), so "car" never matches "card".
 * Arabic keywords match at a word start, allowing common prefixes (ال، و، ب، ف، ل).
 */
function keywordPattern(keyword: string) {
  let pattern = patterns.get(keyword);
  if (!pattern) {
    const kw = escapeRegExp(normalizeText(keyword));
    pattern = /[؀-ۿ]/.test(keyword)
      ? new RegExp(`(^|[^\\p{L}])(وال|بال|فال|لل|ال|و|ب|ف|ل)?${kw}`, "u")
      : new RegExp(`(^|[^\\p{L}\\p{N}])${kw}(s|es)?(?![\\p{L}\\p{N}])`, "u");
    patterns.set(keyword, pattern);
  }
  return pattern;
}

export interface DemoSuggestions {
  language: SuggestionLanguage;
  summary: string;
  parts: PartSuggestion[];
}

/**
 * Phase 2 local engine: curated results for the example projects, otherwise keyword matching.
 * It never calls the network.
 */
export function suggestPartsDemo(description: string): DemoSuggestions {
  const example = findExample(description);
  if (example)
    return {
      language: example.language,
      summary: example.summary,
      parts: example.parts.map((part) => ({ ...part })),
    };
  const language = detectLanguage(description);
  const text = normalizeText(description);
  const has = (keyword: string) => keywordPattern(keyword).test(text);
  const pick = (t: Text) => t[language];
  const found: PartSuggestion[] = [];
  for (const rule of rules)
    if (rule.keywords.some(has))
      found.push({ key: rule.key, quantity: rule.quantity ?? 1, role: pick(rule.role), reason: pick(rule.reason) });
  for (const companion of companions)
    if (found.some((part) => part.key === companion.when) && !found.some((part) => part.key === companion.key))
      found.push({ key: companion.key, quantity: found.find((part) => part.key === companion.when)!.quantity, role: pick(companion.role), reason: pick(companion.reason) });
  const named = controllers.find((controller) => controller.keywords.some(has));
  if (named || found.length)
    found.unshift({ key: named?.key ?? "arduino_uno", quantity: 1, role: pick(controllerText.role), reason: pick(controllerText.reason) });
  const parts = mergeSuggestions(found);
  const summary = !parts.length
    ? ""
    : language === "ar"
      ? `اقتراحات محلية مبنية على كلمات في وصفك: ${parts.length} أنواع من القطع. راجعها قبل الاعتماد.`
      : `Local keyword matches for your description: ${parts.length} part types. Review them before approving.`;
  return { language, summary, parts };
}

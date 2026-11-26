import { CATALOG_MAP } from "./lab/catalog";
import { readLocal, STORAGE_KEYS, writeLocal } from "./storage";

export const catalogCategories = [
  "لوحات تحكم",
  "حساسات",
  "مشغلات ومحركات",
  "شاشات",
  "عناصر إلكترونية",
  "مشغلات طاقة",
  "اتصال لاسلكي",
  "وحدات جاهزة",
];
const rows: [string, string, string, number, number][] = [
  ["arduino_uno", "arduino-uno", "أردوينو أونو", 0, 5],
  ["arduino_nano", "arduino-nano", "أردوينو نانو", 0, 5],
  ["esp32_devkit_v1", "esp32", "لوحة تطوير ESP32", 0, 3.3],
  ["esp8266_nodemcu", "esp8266", "لوحة NodeMCU ESP8266", 0, 3.3],
  ["raspberry_pi_4", "raspberry-pi-4", "راسبيري باي 4", 0, 5],
  ["hc_sr04", "hc-sr04", "حساس مسافة بالموجات فوق الصوتية", 1, 5],
  ["dht11", "dht11", "حساس حرارة ورطوبة DHT11", 1, 5],
  ["dht22", "dht22", "حساس حرارة ورطوبة DHT22", 1, 5],
  ["ldr", "ldr-bare", "مقاومة ضوئية", 4, 0],
  ["pir_hc_sr501", "pir", "حساس حركة PIR", 1, 5],
  ["lm35", "lm35", "حساس حرارة LM35", 1, 5],
  ["mpu6050", "mpu6050", "وحدة حركة وتسارع MPU6050", 1, 3.3],
  ["bmp280", "bmp280", "حساس ضغط BMP280", 1, 3.3],
  ["ir_obstacle", "ir-obstacle", "حساس عوائق بالأشعة تحت الحمراء", 1, 5],
  ["flame_sensor", "flame", "حساس لهب", 1, 5],
  ["mq2_gas", "mq2", "حساس غاز ودخان MQ-2", 1, 5],
  ["soil_moisture", "soil", "حساس رطوبة التربة", 1, 5],
  ["water_level", "water-level", "حساس مستوى الماء", 1, 5],
  ["ldr_module", "ldr", "وحدة حساس ضوئي", 7, 5],
  ["push_button", "push-button", "زر ضغط", 4, 0],
  ["servo_sg90", "sg90", "محرك سيرفو صغير SG90", 2, 5],
  ["servo_mg995", "mg995", "محرك سيرفو MG995", 2, 5],
  ["dc_motor", "dc-motor", "محرك تيار مستمر", 2, 12],
  ["stepper_28byj48", "stepper", "محرك خطوي 28BYJ-48", 2, 5],
  ["buzzer_active", "buzzer", "جرس إلكتروني نشط", 2, 5],
  ["relay_5v", "relay", "وحدة ريليه 5 فولت", 5, 5],
  ["lcd1602_i2c", "lcd-i2c", "شاشة LCD مع I2C", 3, 5],
  ["oled_096", "oled", "شاشة OLED قياس 0.96 بوصة", 3, 3.3],
  ["seven_segment_1digit", "seven-seg", "شاشة سبعة مقاطع لخانة واحدة", 3, 0],
  ["led_red", "led-red", "صمام LED أحمر", 4, 0],
  ["led_green", "led-green", "صمام LED أخضر", 4, 0],
  ["led_rgb", "led-rgb", "صمام LED متعدد الألوان", 4, 0],
  ["resistor_220", "resistor-220", "مقاومة 220 أوم", 4, 0],
  ["resistor_10k", "resistor-10k", "مقاومة 10 كيلو أوم", 4, 0],
  ["potentiometer_10k", "potentiometer", "مقاومة متغيرة 10 كيلو أوم", 4, 0],
  ["l298n", "l298n", "مشغل محركات L298N", 5, 12],
  ["tb6600", "tb6600", "مشغل محرك خطوي TB6600", 5, 12],
  ["uln2003", "uln2003", "لوحة تشغيل ULN2003", 5, 5],
  ["esp8266_module", "esp8266-module", "وحدة واي فاي ESP8266", 6, 3.3],
  ["rfid_rc522", "rfid-rc522", "قارئ بطاقات RFID", 6, 3.3],
  ["hc05_bluetooth", "hc05", "وحدة بلوتوث HC-05", 6, 5],
  ["nrf24l01", "nrf24l01", "وحدة اتصال لاسلكي nRF24L01+", 6, 3.3],
  ["water_pump_5v", "water-pump", "مضخة ماء صغيرة 5 فولت", 2, 5],
];
export const componentCatalog = rows.map(([key, model, arabic, category, voltage]) => {
  const def = CATALOG_MAP[model]!;
  const name =
    key === "raspberry_pi_4"
      ? "Raspberry Pi 4"
      : key === "water_pump_5v"
        ? "5 V Mini Water Pump"
        : def.name;
  return {
    key,
    model,
    arabic,
    category: catalogCategories[category]!,
    voltage,
    name,
    def,
    description: `${arabic} — ${name}. ${category === 0 ? "لوحة لبناء وبرمجة المشاريع الإلكترونية والتحكم بالمكونات." : category === 1 ? "مكوّن لاستشعار الظروف المحيطة وربطه بوحدة التحكم." : category === 2 ? "مكوّن يحوّل إشارة التحكم إلى حركة أو صوت أو تدفق ماء." : category === 3 ? "مكوّن لعرض البيانات والمعلومات في مشروعك." : category === 6 ? "وحدة لإرسال البيانات واستقبالها بين الأجهزة." : "مكوّن لدعم التوصيل والتحكم في الدوائر الإلكترونية."}`,
  };
});
export type CatalogComponent = (typeof componentCatalog)[number];
/** English labels for `catalogCategories`, in the same order (from LabAssist catalog-preview). */
export const catalogCategoryLabels = [
  "Control Boards",
  "Sensors",
  "Motors & Actuators",
  "Displays",
  "Electronic Parts",
  "Power Drivers",
  "Wireless",
  "Modules",
];
export const categoryLabel = (name: string) =>
  catalogCategoryLabels[catalogCategories.indexOf(name)] || name;
export type BomEntry = { key: string; quantity: number };
/** Exact catalog-key lookup; keys are never normalised or guessed. */
export const catalogByKey = new Map(componentCatalog.map((item) => [item.key, item]));
const BOM_KEY = STORAGE_KEYS.bom;
const MAX_QUANTITY = 999;
/**
 * Saved BOM entries. A non-array value is reported as unreadable (and left untouched);
 * entries with an unknown key or an invalid quantity are skipped, as in LabAssist.
 */
export function readBom(): BomEntry[] {
  const parsed = readLocal<unknown[]>(BOM_KEY, [], Array.isArray);
  return parsed.filter(
    (entry): entry is BomEntry =>
      typeof entry === "object" &&
      entry !== null &&
      typeof (entry as BomEntry).key === "string" &&
      Number.isInteger((entry as BomEntry).quantity) &&
      (entry as BomEntry).quantity > 0 &&
      catalogByKey.has((entry as BomEntry).key),
  );
}
/** Throws when the BOM could not be saved. */
function writeBom(entries: BomEntry[]) {
  writeLocal(BOM_KEY, entries);
  return entries;
}
export function addToBom(key: string) {
  const entries = readBom();
  const entry = entries.find((item) => item.key === key);
  if (entry) entry.quantity = Math.min(MAX_QUANTITY, entry.quantity + 1);
  else entries.push({ key, quantity: 1 });
  return writeBom(entries);
}
/** Sets a quantity; zero or less removes the entry. */
export function setBomQuantity(key: string, quantity: number) {
  const next = Math.min(MAX_QUANTITY, Math.floor(quantity));
  const entries = readBom()
    .map((item) => (item.key === key ? { ...item, quantity: next } : item))
    .filter((item) => item.quantity > 0);
  return writeBom(entries);
}
export const removeFromBom = (key: string) => setBomQuantity(key, 0);
/** Adds several entries in one write; quantities add to existing entries. Unknown keys are skipped. */
export function addManyToBom(additions: BomEntry[]) {
  const entries = readBom();
  for (const { key, quantity } of additions) {
    if (!catalogByKey.has(key) || !Number.isInteger(quantity) || quantity < 1) continue;
    const entry = entries.find((item) => item.key === key);
    if (entry) entry.quantity = Math.min(MAX_QUANTITY, entry.quantity + quantity);
    else entries.push({ key, quantity: Math.min(MAX_QUANTITY, quantity) });
  }
  return writeBom(entries);
}
export const clearBom = () => writeBom([]);

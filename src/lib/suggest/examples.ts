import type { PartSuggestion, SuggestionLanguage } from "./types";

export interface ExampleProject {
  id: string;
  title: { en: string; ar: string };
  language: SuggestionLanguage;
  description: string;
  /** Curated local result, used by the demo engine when the AI is not available. */
  summary: string;
  parts: PartSuggestion[];
}

export const exampleProjects: ExampleProject[] = [
  {
    id: "plant-watering",
    title: { en: "Smart plant watering", ar: "ري النباتات الذكي" },
    language: "en",
    description:
      "An automatic plant watering system that measures soil moisture, turns on a small water pump when the soil is dry, and shows the moisture level on a screen.",
    summary:
      "An Arduino reads a soil moisture sensor, switches a 5 V pump through a relay when the soil is dry, and shows the reading on an I²C LCD.",
    parts: [
      { key: "arduino_uno", quantity: 1, role: "Main controller that reads the sensor and decides when to water.", reason: "Runs the watering logic and drives the relay and display." },
      { key: "soil_moisture", quantity: 1, role: "Measures how wet the soil is.", reason: "The watering decision depends on this reading." },
      { key: "relay_5v", quantity: 1, role: "Switches the pump on and off.", reason: "A controller pin cannot power a pump directly." },
      { key: "water_pump_5v", quantity: 1, role: "Moves water to the plant.", reason: "It is the part that actually waters the soil." },
      { key: "lcd1602_i2c", quantity: 1, role: "Shows the moisture level.", reason: "The project asks for the level to be visible on a screen." },
    ],
  },
  {
    id: "robot-car",
    title: { en: "Obstacle-avoiding robot car", ar: "سيارة روبوت تتجنب العوائق" },
    language: "en",
    description:
      "A small two-wheel robot car that drives forward, detects obstacles with an ultrasonic sensor, turns its sensor with a servo to look left and right, and steers away.",
    summary:
      "An Arduino measures distance with an HC-SR04 mounted on a servo, and drives two DC motors through an L298N driver to steer around obstacles.",
    parts: [
      { key: "arduino_uno", quantity: 1, role: "Main controller for sensing and steering.", reason: "Reads the distance sensor and controls the motor driver and servo." },
      { key: "hc_sr04", quantity: 1, role: "Measures the distance to obstacles ahead.", reason: "Obstacle detection is the core of the project." },
      { key: "servo_sg90", quantity: 1, role: "Turns the distance sensor left and right.", reason: "Lets the car compare both sides before turning." },
      { key: "l298n", quantity: 1, role: "Drives the two wheel motors.", reason: "Motors need more current than a controller pin can supply." },
      { key: "dc_motor", quantity: 2, role: "Turns the two wheels.", reason: "One motor per wheel lets the car steer by speed difference." },
    ],
  },
  {
    id: "weather-station",
    title: { en: "Home weather station", ar: "محطة طقس منزلية" },
    language: "ar",
    description:
      "محطة طقس منزلية تقيس درجة الحرارة والرطوبة وتعرضها على شاشة صغيرة، وترسل القراءات إلى الهاتف عبر الواي فاي.",
    summary:
      "لوحة ESP32 تقرأ حساس DHT22 للحرارة والرطوبة، وتعرض القراءات على شاشة OLED، وترسلها عبر الواي فاي المدمج.",
    parts: [
      { key: "esp32_devkit_v1", quantity: 1, role: "وحدة التحكم التي تقرأ الحساس وترسل البيانات.", reason: "تحتوي على واي فاي مدمج لإرسال القراءات إلى الهاتف." },
      { key: "dht22", quantity: 1, role: "يقيس درجة الحرارة والرطوبة.", reason: "هاتان القراءتان هما هدف المشروع." },
      { key: "oled_096", quantity: 1, role: "تعرض القراءات على الجهاز نفسه.", reason: "المشروع يطلب عرض القراءات على شاشة صغيرة." },
    ],
  },
  {
    id: "security-alarm",
    title: { en: "Room security alarm", ar: "جهاز إنذار للغرفة" },
    language: "ar",
    description:
      "جهاز إنذار للغرفة يكتشف حركة الأشخاص ويطلق صوتاً وضوءاً أحمر عند وجود متسلل.",
    summary:
      "أردوينو يقرأ حساس الحركة PIR، وعند اكتشاف حركة يشغّل جرساً إلكترونياً وصمام LED أحمر عبر مقاومة تحديد التيار.",
    parts: [
      { key: "arduino_uno", quantity: 1, role: "وحدة التحكم التي تراقب الحساس وتطلق الإنذار.", reason: "تربط بين اكتشاف الحركة وتشغيل الصوت والضوء." },
      { key: "pir_hc_sr501", quantity: 1, role: "يكتشف حركة الأشخاص في الغرفة.", reason: "اكتشاف المتسلل هو وظيفة المشروع الأساسية." },
      { key: "buzzer_active", quantity: 1, role: "يصدر صوت الإنذار.", reason: "المشروع يطلب تنبيهاً صوتياً." },
      { key: "led_red", quantity: 1, role: "يضيء باللون الأحمر عند الإنذار.", reason: "المشروع يطلب ضوءاً أحمر." },
      { key: "resistor_220", quantity: 1, role: "تحدّ من تيار صمام LED.", reason: "بدونها قد يتلف الصمام أو منفذ وحدة التحكم." },
    ],
  },
];

/** Matches a description to an example when the text is the example's, ignoring spacing. */
export function findExample(description: string) {
  const text = description.replace(/\s+/g, " ").trim();
  return exampleProjects.find((example) => example.description === text) ?? null;
}

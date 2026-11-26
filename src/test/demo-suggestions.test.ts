import { describe, expect, it } from "vitest";
import { suggestPartsDemo } from "../lib/suggest/demoEngine";
import { exampleProjects } from "../lib/suggest/examples";
import { catalogByKey } from "../lib/componentCatalog";
import { detectLanguage } from "../lib/suggest/language";

const keys = (description: string) => suggestPartsDemo(description).parts.map((p) => p.key);

describe("demo suggestion engine", () => {
  it("uses only real catalog keys in every example", () => {
    for (const example of exampleProjects)
      for (const part of example.parts) expect(catalogByKey.has(part.key)).toBe(true);
  });

  it("matches English keywords as whole words and adds needed supporting parts", () => {
    const parts = keys("A night alarm with an LED indicator and a buzzer");
    expect(parts).toEqual(expect.arrayContaining(["arduino_uno", "led_red", "resistor_220", "buzzer_active"]));
    // "card" must not match the "car" keyword.
    expect(keys("An RFID card door lock")).not.toContain("dc_motor");
  });

  it("matches Arabic keywords with common prefixes and answers in Arabic", () => {
    const result = suggestPartsDemo("نظام يقيس الحرارة والرطوبة ويرسلها عبر الواي فاي");
    expect(result.language).toBe("ar");
    expect(result.parts.map((p) => p.key)).toEqual(expect.arrayContaining(["esp32_devkit_v1", "dht22"]));
    expect(result.parts[0]!.role).toMatch(/[؀-ۿ]/);
  });

  it("returns no parts for unrelated text", () => {
    expect(suggestPartsDemo("hello there").parts).toEqual([]);
  });

  it("detects the description language", () => {
    expect(detectLanguage("مشروع سيارة روبوت")).toBe("ar");
    expect(detectLanguage("robot car project")).toBe("en");
  });
});

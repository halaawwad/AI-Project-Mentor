import { beforeEach, describe, expect, it } from "vitest";
import { removeLocal, STORAGE_KEYS } from "@/lib/storage";
import { CATALOG_MAP, pinLocal } from "@/lib/lab/catalog";
import {
  addManyToBom,
  catalogByKey,
  catalogSearchCanOfferGeneration,
  catalogSearchMatches,
  componentCatalog,
  customCatalogComponent,
  findCatalogItemByName,
  readBom,
} from "@/lib/componentCatalog";
import {
  customPartDefinition,
  customPartId,
  deleteCustomPart,
  readCustomParts,
  reloadCustomParts,
  saveCustomPart,
  validateCustomPartSpec,
  type CustomPartSpec,
} from "@/lib/lab/customParts";
import { validateAiSuggestions } from "@/lib/suggest/validate";
import { missingPartsApprovalReminder } from "@/lib/suggest/review";
import { catalogMatchFromLookup } from "@/lib/journey/componentAi";
import { validate } from "@/lib/lab/validate";
import { checkWireFit } from "@/lib/lab/wireCompatibility";
import type { CircuitData } from "@/lib/lab/types";

const spec = (pins: unknown[] = [
  { name: "VCC", kind: "power", logicVoltage: null },
  { name: "DIO", kind: "digital", logicVoltage: 5 },
  { name: "GND", kind: "ground", logicVoltage: null },
]) => ({
  category: "Displays & LEDs",
  boardSizeMm: { width: 30, depth: 20 },
  operatingVoltage: { min: 3.3, max: 5 },
  pins,
});

beforeEach(() => {
  removeLocal(STORAGE_KEYS.customParts);
  removeLocal(STORAGE_KEYS.bom);
  reloadCustomParts();
});

describe("custom part specification", () => {
  it("accepts the known categories and pin kinds with an ordered voltage range", () => {
    expect(validateCustomPartSpec(spec()).spec).toMatchObject({
      category: "Displays & LEDs",
      operatingVoltage: { min: 3.3, max: 5 },
      pins: [
        { name: "VCC", kind: "power" },
        { name: "DIO", kind: "digital" },
        { name: "GND", kind: "ground" },
      ],
    });
  });

  it.each([
    ["duplicate names", spec([
      { name: "VCC", kind: "power", logicVoltage: null },
      { name: "vcc", kind: "digital", logicVoltage: 5 },
      { name: "GND", kind: "ground", logicVoltage: null },
    ])],
    ["unknown kind", spec([
      { name: "VCC", kind: "power", logicVoltage: null },
      { name: "DATA", kind: "unknown", logicVoltage: 5 },
      { name: "GND", kind: "ground", logicVoltage: null },
    ])],
    ["powered part without ground", spec([
      { name: "VCC", kind: "power", logicVoltage: null },
      { name: "DATA", kind: "digital", logicVoltage: 5 },
    ])],
    ["signal without logic voltage", spec([
      { name: "DATA", kind: "digital", logicVoltage: null },
    ])],
  ])("rejects %s", (_, value) => {
    expect(validateCustomPartSpec(value).spec).toBeNull();
  });

  it("repairs only harmless label formatting and a footprint too small for its headers", () => {
    const raw = spec([
      { name: " VCC  ", kind: " POWER ", logicVoltage: null },
      { name: "DATA", kind: "Digital", logicVoltage: 3.3 },
      { name: "GND", kind: "ground" },
    ]);
    raw.boardSizeMm.width = 12;
    const checked = validateCustomPartSpec(raw);
    expect(checked.spec?.pins.map((pin) => pin.name)).toEqual(["VCC", "DATA", "GND"]);
    expect(checked.spec?.boardSizeMm.width).toBe(12.6);
    expect(checked.repaired).toContain("pin name whitespace");
    expect(checked.repaired).toContain("pin kind casing");
    expect(checked.repaired).toContain("non-signal logic voltage");
    expect(checked.spec?.pins[2]?.logicVoltage).toBeNull();
  });
});

describe("custom part storage, model pins and wiring", () => {
  it("persists validated specs, registers them for projects, reloads and deletes them", () => {
    const saved = saveCustomPart("TM1637 4-digit display", spec() as CustomPartSpec);
    expect(readCustomParts()).toEqual([saved]);
    expect(CATALOG_MAP[saved.id]?.pins.map((pin) => pin.name)).toEqual(["VCC", "DIO", "GND"]);

    reloadCustomParts();
    expect(readCustomParts()).toEqual([saved]);
    expect(CATALOG_MAP[saved.id]?.name).toBe(saved.name);
    expect(deleteCustomPart(saved.id)).toBe(true);
    expect(readCustomParts()).toEqual([]);
    expect(CATALOG_MAP[saved.id]).toBeUndefined();
  });

  it("leaves malformed saved data untouched and refuses a write over it", () => {
    localStorage.setItem(STORAGE_KEYS.customParts, "{bad json");
    reloadCustomParts();
    expect(() => saveCustomPart("Test breakout", spec())).toThrow();
    expect(localStorage.getItem(STORAGE_KEYS.customParts)).toBe("{bad json");
    removeLocal(STORAGE_KEYS.customParts);
  });

  it("uses the same pin positions for the generated model and the lab pin targets", () => {
    const manyPins: CustomPartSpec["pins"] = Array.from({ length: 10 }, (_, index) => ({
      name: `D${index}`,
      kind: "digital",
      logicVoltage: 3.3,
    }));
    manyPins.push({ name: "GND", kind: "ground", logicVoltage: null });
    const checked = validateCustomPartSpec(spec(manyPins));
    expect(checked.spec).not.toBeNull();
    const part = {
      id: customPartId("Wide header"),
      name: "Wide header",
      spec: checked.spec!,
    };
    const def = customPartDefinition(part);
    const firstRow = def.pins.slice(0, 6).map((_, index) => pinLocal(def, index));
    const secondRow = def.pins.slice(6).map((_, index) => pinLocal(def, index + 6));
    expect(firstRow.map((position) => position[0])).toEqual(
      [...firstRow].map((position) => position[0]).sort((a, b) => a - b),
    );
    expect(firstRow.every((position) => position[2] > 0)).toBe(true);
    expect(secondRow.every((position) => position[2] < 0)).toBe(true);
    expect(firstRow[0]?.[1]).toBe(0.22);
  });

  it("checks custom pin kinds and voltages in the normal wire validator", () => {
    const saved = saveCustomPart("TM1637 4-digit display", spec());
    const data: CircuitData = {
      parts: [
        { id: "uno", type: "arduino-uno", x: 0, z: 0, rot: 0 },
        { id: "display", type: saved.id, x: 3, z: 0, rot: 0 },
      ],
      wires: [
        { id: "signal", from: { partId: "uno", pin: 2 }, to: { partId: "display", pin: 1 }, color: "#12a594", type: "jumper-mf" },
        { id: "power", from: { partId: "uno", pin: 20 }, to: { partId: "display", pin: 0 }, color: "#e5484d", type: "jumper-mf" },
        { id: "ground", from: { partId: "uno", pin: 22 }, to: { partId: "display", pin: 2 }, color: "#2b2f33", type: "jumper-mf" },
      ],
    };
    expect(checkWireFit(data, { partId: "uno", pin: 2 }, { partId: "display", pin: 1 }, "jumper-mf").ok).toBe(true);
    expect(validate(data).issues).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ type: "Wrong Pin Type" })]),
    );
    const invalid: CircuitData = {
      ...data,
      wires: data.wires.map((wire) =>
        wire.id === "signal"
          ? { ...wire, to: { partId: "display", pin: 0 } }
          : wire,
      ),
    };
    expect(validate(invalid).issues).toEqual(
      expect.arrayContaining([expect.objectContaining({ type: "Wrong Pin Type" })]),
    );
  });

  it("maps missing-part names to saved custom, exact catalog, and known catalog aliases", () => {
    const saved = saveCustomPart("Saved display", spec());
    const checked = validateAiSuggestions(
      {
        language: "en",
        summary: "A timer with a controller, display, and audible alert.",
        parts: [
          { key: "arduino_uno", quantity: 1, role: "Controller", reason: "Runs the timer." },
        ],
        missingParts: [
          { name: "TM1637 4-digit display", quantity: 1, role: "Display", reason: "Shows the countdown." },
          { name: "Saved display", quantity: 2, role: "Display", reason: "Already saved locally." },
          { name: "Arduino Uno", quantity: 1, role: "Controller", reason: "Already in the catalog." },
          { name: "ultrasonic sensor", quantity: 1, role: "Range", reason: "Measures distance." },
          { name: "kicad.org", quantity: 1, role: "Library", reason: "A link must not be suggested." },
        ],
      },
      "A digital countdown timer",
    );
    expect(checked?.missingParts).toEqual([
      expect.objectContaining({ name: "TM1637 4-digit display", quantity: 1 }),
    ]);
    expect(checked?.parts.map((part) => [part.key, part.quantity])).toEqual([
      ["arduino_uno", 2],
      [saved.id, 2],
      ["hc_sr04", 1],
    ]);
    expect(checked?.dropped).toBe(1);
    const cachedAgain = validateAiSuggestions(checked?.cacheValue, "A digital countdown timer");
    expect(cachedAgain?.parts.map((part) => [part.key, part.quantity])).toEqual([
      ["arduino_uno", 2],
      [saved.id, 2],
      ["hc_sr04", 1],
    ]);
    expect(cachedAgain?.missingParts.map((part) => part.name)).toEqual([
      "TM1637 4-digit display",
    ]);
  });

  it("resolves Gemini's canonical part name to the existing catalog item", () => {
    expect(findCatalogItemByName("HC-SR04")?.key).toBe("hc_sr04");
    const saved = saveCustomPart("Saved sensor", spec());
    expect(
      catalogMatchFromLookup({
        kind: "ai",
        info: {
          name: "HC-SR04",
          whatItIs: "A common ultrasonic distance sensor module.",
          typicalPins: [{ name: "TRIG", function: "Trigger input" }],
          voltage: "5 V",
          typicalUse: "It measures distance using reflected sound waves.",
          projectFit: "It can measure distance for this project.",
          safetyNotes: ["Check the module's voltage before wiring."],
        },
      }),
    ).toMatchObject({ key: "hc_sr04" });
    expect(
      catalogMatchFromLookup({
        kind: "ai",
        info: {
          name: saved.name,
          whatItIs: "A locally saved sensor module for student projects.",
          typicalPins: [{ name: "TRIG", function: "Trigger input" }],
          voltage: "5 V",
          typicalUse: "It senses a physical condition for a project.",
          projectFit: "It can provide a sensor reading for this project.",
          safetyNotes: ["Check the saved part's voltage before wiring."],
        },
      }),
    ).toMatchObject({ key: saved.id });
  });

  it("offers the search action for non-empty searches even when results already exist", () => {
    const saved = saveCustomPart("TM1637 4-digit display", spec());
    const allItems = [...componentCatalog, customCatalogComponent(saved)];
    expect(catalogSearchMatches(allItems.at(-1)!, "TM1637")).toBe(true);
    expect(catalogSearchMatches(componentCatalog[0]!, "اردوينو")).toBe(true);
    expect(catalogSearchCanOfferGeneration("Arduino")).toBe(true);
    expect(catalogSearchCanOfferGeneration("  ")).toBe(false);
  });

  it("reminds the student when a missing suggestion is not generated, mapped, or skipped", () => {
    const missing = [
      { name: "TM1637 display", quantity: 1, role: "Display", reason: "Shows the timer." },
    ];
    expect(missingPartsApprovalReminder(missing, [])).toContain("Generate or skip");
    expect(missingPartsApprovalReminder(missing, ["TM1637 display"])).toBeNull();
  });

  it("approves a reviewed list containing a generated custom part into the BOM", () => {
    const saved = saveCustomPart("TM1637 4-digit display", spec());
    const approved = addManyToBom([
      { key: "arduino_uno", quantity: 1 },
      { key: saved.id, quantity: 3 },
    ]);
    expect(approved).toEqual([
      { key: "arduino_uno", quantity: 1 },
      { key: saved.id, quantity: 3 },
    ]);
    expect(readBom()).toEqual(approved);
    expect(catalogByKey.get(saved.id)?.custom).toBe(true);
  });
});

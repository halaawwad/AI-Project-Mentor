import { useSyncExternalStore } from "react";
import { readLocal, STORAGE_KEYS, unreadableKeys, writeLocal } from "@/lib/storage";
import { CATALOG_MAP, CATEGORIES, type Category, type PartDef, type PinDef, type PinKind } from "./catalog";

export interface CustomPartSpec {
  category: Category;
  boardSizeMm: { width: number; depth: number };
  operatingVoltage: { min: number; max: number };
  pins: { name: string; kind: PinKind; logicVoltage: number | null }[];
}

export interface SavedCustomPart {
  id: string;
  name: string;
  spec: CustomPartSpec;
}

export interface PartSpecCheck {
  spec: CustomPartSpec | null;
  repaired: string[];
  rejected: string[];
}

const PIN_KINDS: PinKind[] = [
  "power",
  "ground",
  "digital",
  "analog",
  "pwm",
  "sda",
  "scl",
  "tx",
  "rx",
  "spi",
  "motor",
  "passive",
];
const SIGNAL_KINDS = new Set<PinKind>([
  "digital",
  "analog",
  "pwm",
  "sda",
  "scl",
  "tx",
  "rx",
  "spi",
]);
const STORAGE_KEY = STORAGE_KEYS.customParts;
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const hasOnlyKeys = (value: Record<string, unknown>, keys: string[]) =>
  Object.keys(value).every((key) => keys.includes(key)) && keys.every((key) => key in value);
const cleanName = (name: string) => name.replace(/[\u0000-\u001f<>]/g, "").replace(/\s+/g, " ").trim();
const validNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);
const clampNear = (value: number, min: number, max: number) =>
  value < min && value >= min - 0.5 ? min : value > max && value <= max + 0.5 ? max : value;

/** Strictly checks a Gemini part spec; only whitespace, casing, and near-boundary sizes are repaired. */
export function validateCustomPartSpec(raw: unknown): PartSpecCheck {
  const repaired: string[] = [];
  const rejected: string[] = [];
  const reject = (reason: string): PartSpecCheck => ({ spec: null, repaired, rejected: [...rejected, reason] });
  if (!isRecord(raw) || !hasOnlyKeys(raw, ["category", "boardSizeMm", "operatingVoltage", "pins"]))
    return reject("missing or unexpected spec fields");

  if (typeof raw["category"] !== "string") return reject("unknown category");
  const categoryText = raw["category"].trim();
  const category = CATEGORIES.find((candidate) => candidate === categoryText);
  if (!category) return reject("unknown category");
  if (categoryText !== raw["category"]) repaired.push("category whitespace");

  const board = raw["boardSizeMm"];
  if (
    !isRecord(board) ||
    !hasOnlyKeys(board, ["width", "depth"]) ||
    !validNumber(board["width"]) ||
    !validNumber(board["depth"])
  )
    return reject("invalid board dimensions");
  let width = clampNear(board["width"], 10, 120);
  let depth = clampNear(board["depth"], 10, 120);
  if (width < 10 || width > 120 || depth < 10 || depth > 120)
    return reject("board dimensions must be 10–120 mm");
  if (width !== board["width"] || depth !== board["depth"]) repaired.push("board size limit");

  const voltage = raw["operatingVoltage"];
  if (
    !isRecord(voltage) ||
    !hasOnlyKeys(voltage, ["min", "max"]) ||
    !validNumber(voltage["min"]) ||
    !validNumber(voltage["max"]) ||
    voltage["min"] < 0.1 ||
    voltage["max"] > 60 ||
    voltage["min"] > voltage["max"]
  )
    return reject("operating voltage must be an ordered range from 0.1–60 V");

  const rawPins = raw["pins"];
  if (!Array.isArray(rawPins) || rawPins.length < 1 || rawPins.length > 40)
    return reject("pin count must be 1–40");
  const pins: CustomPartSpec["pins"] = [];
  const names = new Set<string>();
  for (const rawPin of rawPins) {
    if (!isRecord(rawPin) || !["name", "kind"].every((key) => key in rawPin) ||
      Object.keys(rawPin).some((key) => !["name", "kind", "logicVoltage"].includes(key)))
      return reject("invalid pin fields");
    if (typeof rawPin["name"] !== "string" || typeof rawPin["kind"] !== "string")
      return reject("pin name or kind is missing");
    const name = cleanName(rawPin["name"]);
    if (name.length < 1 || name.length > 24) return reject("pin names must be 1–24 characters");
    if (name !== rawPin["name"]) repaired.push("pin name whitespace");
    const uniqueName = name.normalize("NFKC").toLowerCase();
    if (names.has(uniqueName)) return reject("pin names must be unique");
    names.add(uniqueName);

    const kindText = rawPin["kind"].trim().toLowerCase();
    if (!PIN_KINDS.includes(kindText as PinKind)) return reject("unknown pin kind");
    const kind = kindText as PinKind;
    if (kindText !== rawPin["kind"]) repaired.push("pin kind casing");

    let logicVoltage: number | null;
    if (rawPin["logicVoltage"] === undefined && !SIGNAL_KINDS.has(kind)) {
      logicVoltage = null;
      repaired.push("non-signal logic voltage");
    } else if (rawPin["logicVoltage"] === null && !SIGNAL_KINDS.has(kind)) {
      logicVoltage = null;
    } else if (validNumber(rawPin["logicVoltage"]) && SIGNAL_KINDS.has(kind)) {
      logicVoltage = rawPin["logicVoltage"];
      if (logicVoltage < 0.1 || logicVoltage > 5.5) return reject("signal logic voltage must be 0.1–5.5 V");
    } else {
      return reject("signal pins need a logic voltage; other pins use null");
    }
    pins.push({ name, kind, logicVoltage });
  }
  if (pins.some((pin) => pin.kind === "power") && !pins.some((pin) => pin.kind === "ground"))
    return reject("powered parts need at least one ground pin");

  const rowPins = pins.length > 8 ? Math.ceil(pins.length / 2) : pins.length;
  const requiredWidth = Math.max(10, rowPins * 2.54 + 5);
  if (requiredWidth > 120) return reject("pin count cannot fit the maximum board width");
  if (width < requiredWidth) {
    width = Math.round(requiredWidth * 10) / 10;
    repaired.push("board width for pin spacing");
  }
  if (pins.length > 8 && depth < 20) {
    depth = 20;
    repaired.push("board depth for two header rows");
  }

  return {
    spec: {
      category,
      boardSizeMm: { width, depth },
      operatingVoltage: { min: voltage["min"], max: voltage["max"] },
      pins,
    },
    repaired: [...new Set(repaired)],
    rejected,
  };
}

const categoryColors: Record<Category, string> = {
  Microcontrollers: "#147c96",
  Sensors: "#247b68",
  Actuators: "#b05b2d",
  "Displays & LEDs": "#315a96",
  "Passive & Input": "#9a762e",
  "Motor Drivers": "#8b4655",
  Wireless: "#5d4b8a",
};

export function customPartId(name: string) {
  const normalized = cleanName(name).normalize("NFKC").toLowerCase();
  const slug = normalized.replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 32) || "part";
  let hash = 2166136261;
  for (const char of normalized) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return `custom-${slug}-${(hash >>> 0).toString(36)}`;
}

export function customPartDefinition(part: SavedCustomPart): PartDef {
  const { spec } = part;
  const twoRows = spec.pins.length > 8;
  const rowLength = twoRows ? Math.ceil(spec.pins.length / 2) : spec.pins.length;
  const pins: PinDef[] = spec.pins.map((pin, index) => {
    const row = twoRows ? Math.floor(index / rowLength) : 0;
    return {
      name: pin.name,
      kind: pin.kind,
      dir: pin.kind === "power" || pin.kind === "ground" ? "in" : "io",
      ...(pin.kind === "ground"
        ? { voltage: 0 }
        : pin.kind === "power"
          ? { voltage: spec.operatingVoltage.max }
          : pin.logicVoltage !== null
            ? { voltage: pin.logicVoltage }
            : {}),
      physicalNumber: index + 1,
      headerSide: row === 0 ? "left" : "right",
      headerRow: row,
    };
  });
  return {
    id: part.id,
    name: part.name,
    category: spec.category,
    w: spec.boardSizeMm.width / 10,
    d: spec.boardSizeMm.depth / 10,
    h: 0.36,
    color: categoryColors[spec.category],
    vMax: spec.operatingVoltage.max,
    draw: 0,
    logic: pins.find((pin) => SIGNAL_KINDS.has(pin.kind) && pin.voltage !== undefined)?.voltage ?? 5,
    pins,
  };
}

function isSavedCustomPart(value: unknown): value is SavedCustomPart {
  if (
    !isRecord(value) ||
    Object.keys(value).some((key) => !["id", "name", "spec"].includes(key)) ||
    typeof value["id"] !== "string" ||
    typeof value["name"] !== "string"
  )
    return false;
  const name = cleanName(value["name"]);
  const check = validateCustomPartSpec(value["spec"]);
  return (
    name.length >= 2 &&
    name.length <= 80 &&
    name === value["name"] &&
    !/https?:\/\/|www\.|\.pdf\b/i.test(name) &&
    value["id"] === customPartId(name) &&
    check.spec !== null
  );
}

function isSavedList(value: unknown): value is SavedCustomPart[] {
  return (
    Array.isArray(value) &&
    value.every(isSavedCustomPart) &&
    new Set(value.map((part) => (part as SavedCustomPart).id)).size === value.length
  );
}

let memory: SavedCustomPart[] | null = null;
let registered = new Set<string>();
let version = 0;
const listeners = new Set<() => void>();
const notify = () => {
  version += 1;
  listeners.forEach((listener) => listener());
};
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

function load() {
  if (!memory) {
    memory = readLocal<SavedCustomPart[]>(STORAGE_KEY, [], isSavedList).map((part) => ({
      ...part,
      spec: validateCustomPartSpec(part.spec).spec!,
    }));
    syncCatalog(memory);
  }
  return memory;
}

function syncCatalog(parts: SavedCustomPart[]) {
  const ids = new Set(parts.map((part) => part.id));
  for (const id of registered) if (!ids.has(id)) delete CATALOG_MAP[id];
  for (const part of parts) CATALOG_MAP[part.id] = customPartDefinition(part);
  registered = ids;
}

export function readCustomParts() {
  return load();
}

export const customPartsStorageReadable = () => !unreadableKeys().includes(STORAGE_KEY);

export function saveCustomPart(name: string, rawSpec: unknown) {
  const clean = cleanName(name);
  const check = validateCustomPartSpec(rawSpec);
  if (clean.length < 2 || clean.length > 80 || !check.spec)
    throw new Error("The custom part name or validated pin specification is not usable.");
  const part: SavedCustomPart = { id: customPartId(clean), name: clean, spec: check.spec };
  const next = [...load().filter((saved) => saved.id !== part.id), part];
  writeLocal(STORAGE_KEY, next);
  memory = next;
  syncCatalog(next);
  notify();
  return part;
}

export function deleteCustomPart(id: string) {
  const next = load().filter((part) => part.id !== id);
  if (next.length === memory!.length) return false;
  writeLocal(STORAGE_KEY, next);
  memory = next;
  syncCatalog(next);
  notify();
  return true;
}

/** Drops the in-memory snapshot so tests and explicit reloads exercise the storage validator. */
export function reloadCustomParts() {
  memory = null;
  version += 1;
  return load();
}

export function useCustomParts() {
  useSyncExternalStore(subscribe, () => version, () => 0);
  return load();
}

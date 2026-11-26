import { useCallback, useEffect, useRef, useState } from "react";
import { readLocal, STORAGE_KEYS, writeLocal } from "../storage";
import { CATALOG_MAP } from "./catalog";
import { uid, type Circuit, type CircuitData, type Project } from "./types";

const KEY = STORAGE_KEYS.labProject;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);
const isCircuitData = (value: unknown) =>
  isRecord(value) && Array.isArray(value["parts"]) && Array.isArray(value["wires"]);
/** Structural check of a saved project; anything else is treated as unreadable. */
function isProject(value: unknown): boolean {
  if (!isRecord(value) || typeof value["name"] !== "string") return false;
  const circuits = value["circuits"];
  return (
    typeof value["activeId"] === "string" &&
    Array.isArray(circuits) &&
    circuits.length > 0 &&
    circuits.every(
      (c) =>
        isRecord(c) &&
        typeof c["id"] === "string" &&
        typeof c["name"] === "string" &&
        isCircuitData(c["data"]) &&
        Array.isArray(c["versions"]) &&
        c["versions"].every(
          (v) =>
            isRecord(v) &&
            typeof v["id"] === "string" &&
            typeof v["label"] === "string" &&
            isCircuitData(v["data"]),
        ),
    )
  );
}
/**
 * Keeps only parts whose type exists in the lab catalog and wires whose two ends point at an
 * existing part pin, so older or edited saves cannot crash the 3D engine or validation.
 */
function sanitizeData(data: CircuitData): CircuitData {
  const parts = data.parts.filter(
    (p) =>
      isRecord(p) &&
      typeof p.id === "string" &&
      typeof p.type === "string" &&
      !!CATALOG_MAP[p.type] &&
      isFiniteNumber(p.x) &&
      isFiniteNumber(p.z) &&
      isFiniteNumber(p.rot),
  );
  const pinCount = new Map(parts.map((p) => [p.id, CATALOG_MAP[p.type]!.pins.length]));
  const validEnd = (end: unknown) =>
    isRecord(end) &&
    typeof end["partId"] === "string" &&
    Number.isInteger(end["pin"]) &&
    (end["pin"] as number) >= 0 &&
    (end["pin"] as number) < (pinCount.get(end["partId"] as string) ?? 0);
  const wires = data.wires.filter(
    (w) =>
      isRecord(w) &&
      typeof w.id === "string" &&
      typeof w.color === "string" &&
      validEnd(w.from) &&
      validEnd(w.to),
  );
  return { parts, wires };
}
function sanitizeProject(project: Project): Project {
  const circuits = project.circuits.map((c) => ({
    ...c,
    updated: isFiniteNumber(c.updated) ? c.updated : Date.now(),
    data: sanitizeData(c.data),
    versions: c.versions.map((v) => ({
      ...v,
      date: isFiniteNumber(v.date) ? v.date : Date.now(),
      data: sanitizeData(v.data),
    })),
  }));
  const activeId = circuits.some((c) => c.id === project.activeId)
    ? project.activeId
    : circuits[0]!.id;
  return { ...project, circuits, activeId };
}

function sample(): CircuitData {
  const uno = uid();
  const led = uid();
  const res = uid();
  return {
    parts: [
      { id: uno, type: "arduino-uno", x: -2, z: 0, rot: 0 },
      { id: res, type: "resistor-220", x: 3, z: 2.5, rot: 0 },
      { id: led, type: "led-red", x: 5, z: 1, rot: 0 },
    ],
    wires: [
      { id: uid(), from: { partId: uno, pin: 10 }, to: { partId: res, pin: 0 }, color: "#12a594" },
      { id: uid(), from: { partId: res, pin: 1 }, to: { partId: led, pin: 0 }, color: "#f5a524" },
      { id: uid(), from: { partId: uno, pin: 3 }, to: { partId: led, pin: 1 }, color: "#2b2f33" },
    ],
  };
}

const newCircuit = (name: string, data: CircuitData = { parts: [], wires: [] }): Circuit => ({
  id: uid(),
  name,
  data,
  versions: [],
  updated: Date.now(),
});

function initial(): Project {
  const saved = readLocal<Project | null>(KEY, null, isProject);
  if (saved) return sanitizeProject(saved);
  const c = newCircuit("Blink LED Circuit", sample());
  return { name: "Smart Greenhouse", circuits: [c], activeId: c.id };
}

const clone = <T>(v: T): T => structuredClone(v);

export function useProject() {
  const [project, setProject] = useState<Project>(initial);
  const [dirty, setDirty] = useState(false);
  const past = useRef<CircuitData[]>([]);
  const future = useRef<CircuitData[]>([]);
  const [, force] = useState(0);

  const active = project.circuits.find((c) => c.id === project.activeId) ?? project.circuits[0]!;

  const patchActive = useCallback((fn: (c: Circuit) => Circuit) => {
    setProject((p) => ({
      ...p,
      circuits: p.circuits.map((c) => (c.id === p.activeId ? fn(c) : c)),
    }));
  }, []);

  /** Apply an undoable edit to the active circuit's data. */
  const edit = useCallback(
    (fn: (d: CircuitData) => CircuitData) => {
      patchActive((c) => {
        past.current.push(clone(c.data));
        if (past.current.length > 100) past.current.shift();
        future.current = [];
        return { ...c, data: fn(clone(c.data)), updated: Date.now() };
      });
      setDirty(true);
      force((n) => n + 1);
    },
    [patchActive],
  );

  const undo = useCallback(() => {
    const prev = past.current.pop();
    if (!prev) return;
    patchActive((c) => {
      future.current.push(clone(c.data));
      return { ...c, data: prev };
    });
    setDirty(true);
    force((n) => n + 1);
  }, [patchActive]);

  const redo = useCallback(() => {
    const next = future.current.pop();
    if (!next) return;
    patchActive((c) => {
      past.current.push(clone(c.data));
      return { ...c, data: next };
    });
    setDirty(true);
    force((n) => n + 1);
  }, [patchActive]);

  const resetHistory = () => {
    past.current = [];
    future.current = [];
    force((n) => n + 1);
  };

  /** Returns false when the browser refused the write; the circuit stays on screen. */
  const save = useCallback(() => {
    try {
      writeLocal(KEY, project);
    } catch {
      return false;
    }
    setDirty(false);
    return true;
  }, [project]);

  // persist when save() is called via state – also keep latest for version ops.
  // Failures are reported by the global storage notice; unreadable saves are never overwritten.
  useEffect(() => {
    if (dirty) return;
    try {
      writeLocal(KEY, project);
    } catch {
      /* reported through storageFailure */
    }
  }, [project, dirty]);

  const createCircuit = (name: string) => {
    const c = newCircuit(name);
    setProject((p) => ({ ...p, circuits: [...p.circuits, c], activeId: c.id }));
    resetHistory();
    setDirty(true);
  };
  const switchCircuit = (id: string) => {
    setProject((p) => ({ ...p, activeId: id }));
    resetHistory();
  };
  const renameCircuit = (id: string, name: string) => {
    setProject((p) => ({
      ...p,
      circuits: p.circuits.map((c) => (c.id === id ? { ...c, name } : c)),
    }));
    setDirty(true);
  };
  const deleteCircuit = (id: string) => {
    setProject((p) => {
      if (p.circuits.length <= 1) return p;
      const circuits = p.circuits.filter((c) => c.id !== id);
      return { ...p, circuits, activeId: p.activeId === id ? circuits[0]!.id : p.activeId };
    });
    resetHistory();
    setDirty(true);
  };
  const saveVersion = (label: string) => {
    patchActive((c) => ({
      ...c,
      versions: [{ id: uid(), label, date: Date.now(), data: clone(c.data) }, ...c.versions],
    }));
    setDirty(false);
  };
  const restoreVersion = (vid: string) => {
    const v = active.versions.find((x) => x.id === vid);
    if (v) edit(() => clone(v.data));
  };

  return {
    project,
    active,
    dirty,
    edit,
    undo,
    redo,
    canUndo: past.current.length > 0,
    canRedo: future.current.length > 0,
    save,
    createCircuit,
    switchCircuit,
    renameCircuit,
    deleteCircuit,
    saveVersion,
    restoreVersion,
  };
}

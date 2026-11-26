import { ApiError, ThinkingLevel, type GenerateContentParameters } from "@google/genai";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { lookupComponent } from "../lib/journey/componentAi";
import { partData } from "../lib/journey/aiQuiz";
import { assessLevel } from "../lib/journey/levelAi";
import { levelQuestions } from "../lib/journey/level";
import { basics } from "../lib/journey/projects";
import { classifyError, generateStructured, thinkingConfigFor, type AiClient } from "../lib/suggest/aiEngine";
import { DEFAULT_TIMEOUT_MS, readAiConfig, type AiConfig } from "../lib/suggest/config";
import { aiCallLogs, clearAiCallLogs, redact } from "../lib/suggest/diagnostics";
import { suggestParts } from "../lib/suggest";

const config: AiConfig = { apiKey: "test-key-1234567890", model: "gemini-3.6-flash", timeoutMs: 5_000 };
const answers = levelQuestions.map((q) => q.correct);
function fakeClient(generate: (params: GenerateContentParameters) => Promise<unknown>) {
  const spy = vi.fn(generate);
  return { client: { models: { generateContent: spy } } as unknown as AiClient, spy };
}
const ok = (body: unknown) => ({ text: JSON.stringify(body), candidates: [{ finishReason: "STOP" }] });

beforeEach(() => {
  clearAiCallLogs();
  vi.stubGlobal("fetch", vi.fn(() => { throw new Error("Network access is disabled in tests"); }));
});
afterEach(() => vi.unstubAllGlobals());

describe("thinking configuration", () => {
  it("uses the lowest supported thinking setting per model", () => {
    expect(thinkingConfigFor("gemini-3.6-flash")).toEqual({ thinkingLevel: ThinkingLevel.MINIMAL });
    expect(thinkingConfigFor("gemini-3.5-flash-lite")).toEqual({ thinkingLevel: ThinkingLevel.MINIMAL });
    expect(thinkingConfigFor("gemini-3-pro-preview")).toEqual({ thinkingLevel: ThinkingLevel.LOW });
    expect(thinkingConfigFor("gemini-2.5-flash")).toEqual({ thinkingBudget: 0 });
    expect(thinkingConfigFor("gemini-2.5-pro")).toEqual({ thinkingBudget: 128 });
    expect(thinkingConfigFor("gemini-2.0-flash")).toBeUndefined();
    expect(thinkingConfigFor("some-other-model")).toBeUndefined();
  });

  it("sends it with every structured call (suggestions and the AI features)", async () => {
    const suggest = fakeClient(async () => ok({ language: "en", summary: "A plan.", parts: [{ key: "arduino_uno", quantity: 1, role: "Controller.", reason: "Runs it." }] }));
    await suggestParts("a blinking light", { config, client: suggest.client });
    const level = fakeClient(async () => ok({ level: "intermediate", difficulty: "medium", reason: "إجاباتك صحيحة ومناسبة للمستوى المتوسط." }));
    await assessLevel({ learnerId: "a", rating: 1, answers, language: "ar", config, client: level.client });
    for (const spy of [suggest.spy, level.spy]) {
      const params = spy.mock.calls[0]![0];
      expect(params.config?.thinkingConfig).toEqual({ thinkingLevel: ThinkingLevel.MINIMAL });
      expect(params.config?.responseMimeType).toBe("application/json");
      expect(params.config?.httpOptions?.retryOptions).toBeUndefined();
    }
    const older = fakeClient(async () => ok({ level: "intermediate", difficulty: "medium", reason: "إجاباتك صحيحة ومناسبة للمستوى المتوسط." }));
    await assessLevel({ learnerId: "b", rating: 1, answers, language: "ar", config: { ...config, model: "gemini-2.0-flash" }, client: older.client });
    expect(older.spy.mock.calls[0]![0].config).not.toHaveProperty("thinkingConfig");
  });
});

describe("timeouts and error mapping", () => {
  it("waits up to 90 seconds by default", () => {
    expect(DEFAULT_TIMEOUT_MS).toBe(90_000);
    expect(readAiConfig({ VITE_GEMINI_API_KEY: "k", VITE_GEMINI_MODEL: "" }).timeoutMs).toBe(90_000);
  });

  it.each<[string, unknown, boolean]>([
    ["timeout", new DOMException("The operation was aborted.", "AbortError"), true],
    ["network", new DOMException("The operation was aborted.", "AbortError"), false],
    ["network", new TypeError("Failed to fetch"), false],
    ["model-not-found", new ApiError({ status: 404, message: '{"error":{"status":"NOT_FOUND"}}' }), false],
    ["invalid-key", new ApiError({ status: 400, message: "API key not valid" }), false],
    ["rate-limit", new ApiError({ status: 429, message: "RESOURCE_EXHAUSTED" }), false],
    ["unavailable", new ApiError({ status: 503, message: "UNAVAILABLE" }), false],
    ["server-error", new ApiError({ status: 500, message: "INTERNAL" }), false],
    ["permission", new ApiError({ status: 403, message: "PERMISSION_DENIED" }), false],
  ])("maps to %s", (reason, error, timedOut) => {
    expect(classifyError(error, timedOut)).toBe(reason);
  });

  it("logs feature, model, duration, outcome and HTTP status, never the key", async () => {
    const failing = fakeClient(async () => {
      throw new ApiError({ status: 503, message: `overloaded for key ${config.apiKey} and AIzaSyA1234567890abcdefghijklmnop` });
    });
    await expect(
      generateStructured({ ...failing, model: config.model, timeoutMs: 1000, apiKey: config.apiKey, client: failing.client }, { feature: "test", system: "s", contents: "c", schema: {}, validate: () => 1 }),
    ).rejects.toMatchObject({ reason: "unavailable", status: 503 });
    const [entry] = aiCallLogs();
    expect(entry).toMatchObject({ feature: "test", model: "gemini-3.6-flash", outcome: "unavailable", status: 503 });
    expect(entry!.durationMs).toBeGreaterThanOrEqual(0);
    expect(JSON.stringify(aiCallLogs())).not.toContain(config.apiKey);
    expect(JSON.stringify(aiCallLogs())).not.toContain("AIzaSyA1234567890");
    expect(redact("key=AIzaSyA1234567890abcdefghijklmnop")).toBe("key=[redacted]");
    const good = fakeClient(async () => ok({ x: 1 }));
    await generateStructured({ client: good.client, model: config.model, timeoutMs: 1000 }, { feature: "ok-test", system: "s", contents: "c", schema: {}, validate: (raw) => raw });
    expect(aiCallLogs()[0]).toMatchObject({ feature: "ok-test", outcome: "ok" });
    const invalid = fakeClient(async () => ok({ x: 1 }));
    await expect(
      generateStructured({ client: invalid.client, model: config.model, timeoutMs: 1000 }, { feature: "bad", system: "s", contents: "c", schema: {}, validate: () => null }),
    ).rejects.toMatchObject({ reason: "bad-response" });
    expect(aiCallLogs()[0]).toMatchObject({ feature: "bad", outcome: "bad-response" });
  });

  it("reports the reason in a feature result (component lookup on a missing model)", async () => {
    const { client } = fakeClient(async () => {
      throw new ApiError({ status: 404, message: "models/gemini-9 is not found" });
    });
    const result = await lookupComponent({ learnerId: "a", ctx: { name: "TM1637 display", language: "ar", projectTitle: "", projectParts: [] }, config, client });
    expect(result).toEqual({ kind: "none", fallbackReason: "model-not-found" });
  });
});

describe("prompt size", () => {
  it("sends only the stage's parts, with controller pins as names only", () => {
    const data = partData(basics);
    const lines = data.split("\n");
    expect(lines).toHaveLength(basics.parts.length);
    const uno = lines.find((l) => l.includes("[arduino_uno]"))!;
    expect(uno).toContain("pins: ");
    expect(uno).not.toMatch(/\((digital|power|analog|pwm|ground)/);
    expect(lines.find((l) => l.includes("[led_red]"))).toContain("ANODE (passive)");
    expect(data).not.toContain("[hc_sr04]");
    expect(data.length).toBeLessThan(1500);
  });
});

import { ApiError, type GenerateContentParameters } from "@google/genai";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { suggestParts } from "../lib/suggest";
import { buildSchema, buildSystemPrompt, type AiClient } from "../lib/suggest/aiEngine";
import type { AiConfig } from "../lib/suggest/config";
import { exampleProjects } from "../lib/suggest/examples";
import { validateAiSuggestions } from "../lib/suggest/validate";
import { componentCatalog } from "../lib/componentCatalog";

const config: AiConfig = { apiKey: "test-key", model: "gemini-3.5-flash", timeoutMs: 5_000 };
const noKey: AiConfig = { ...config, apiKey: "" };

type Generate = (params: GenerateContentParameters) => Promise<unknown>;
function fakeClient(generate: Generate) {
  const spy = vi.fn(generate);
  return { client: { models: { generateContent: spy } } as unknown as AiClient, spy };
}
/** Minimal GenerateContentResponse: `text` mirrors the SDK getter. */
const response = (text: string | undefined, finishReason = "STOP", extra: object = {}) => ({
  text,
  candidates: [{ finishReason, content: { role: "model", parts: text ? [{ text }] : [] } }],
  ...extra,
});
const reply = (body: unknown) => fakeClient(async () => response(JSON.stringify(body)));
const apiError = (status: number, message: string) => new ApiError({ status, message });

const description =
  "A robot car that avoids obstacles with an ultrasonic sensor and two wheel motors.";

beforeEach(() => {
  // No test may reach the real API, even by accident.
  vi.stubGlobal(
    "fetch",
    vi.fn(() => {
      throw new Error("Network access is disabled in tests");
    }),
  );
});
afterEach(() => vi.unstubAllGlobals());

describe("AI suggestions (Gemini)", () => {
  it("returns validated AI suggestions and sends one catalog-constrained JSON request", async () => {
    const { client, spy } = reply({
      language: "en",
      summary: "An Arduino reads an HC-SR04 and drives two motors through an L298N.",
      parts: [
        { key: "arduino_uno", quantity: 1, role: "Controller", reason: "Runs the logic." },
        { key: "hc_sr04", quantity: 1, role: "Distance sensor", reason: "Detects obstacles." },
        { key: "dc_motor", quantity: 2, role: "Wheel motors", reason: "Move the car." },
      ],
    });
    const result = await suggestParts(description, { config, client });
    expect(result.source).toBe("ai");
    expect(result.fallbackReason).toBeUndefined();
    expect(result.language).toBe("en");
    expect(result.parts.map((p) => [p.key, p.quantity])).toEqual([
      ["arduino_uno", 1],
      ["hc_sr04", 1],
      ["dc_motor", 2],
    ]);
    expect(result.droppedCount).toBe(0);

    expect(spy).toHaveBeenCalledTimes(1);
    const [params] = spy.mock.calls[0]!;
    expect(params.model).toBe("gemini-3.5-flash");
    expect(params.config?.responseMimeType).toBe("application/json");
    expect(params.config?.responseJsonSchema).toEqual(buildSchema());
    expect(params.config?.httpOptions?.retryOptions).toBeUndefined();
    expect(String(params.contents)).toContain(description);
    const system = String(params.config?.systemInstruction);
    for (const item of componentCatalog) expect(system).toContain(item.key);
    expect(JSON.stringify(params)).not.toContain("test-key");
  });

  it("removes unknown catalog keys and invalid quantities, and merges duplicates", async () => {
    const { client } = reply({
      language: "en",
      summary: "Summary",
      parts: [
        { key: "arduino_uno", quantity: 1, role: "Controller", reason: "Runs the logic." },
        { key: "flux_capacitor", quantity: 1, role: "Time travel", reason: "Not real." },
        { key: "led_red", quantity: 0, role: "Indicator", reason: "Zero is invalid." },
        { key: "hc_sr04", quantity: 1.5, role: "Sensor", reason: "Fractions are invalid." },
        { key: "resistor_220", quantity: 2, role: "LED resistor", reason: "Limits current." },
        { key: "resistor_220", quantity: 1, role: "Pull-down", reason: "Second use." },
        "not an object",
        { key: "buzzer_active", quantity: 1, role: "", reason: "Missing role." },
      ],
    });
    const result = await suggestParts(description, { config, client });
    expect(result.source).toBe("ai");
    expect(result.parts.map((p) => p.key)).toEqual(["arduino_uno", "resistor_220"]);
    const resistor = result.parts.find((p) => p.key === "resistor_220")!;
    expect(resistor.quantity).toBe(3);
    expect(resistor.role).toBe("LED resistor · Pull-down");
    expect(result.droppedCount).toBe(5);
  });

  it("shows the empty state (no parts) when nothing valid remains", async () => {
    const { client } = reply({
      language: "en",
      summary: "Nothing fits.",
      parts: [{ key: "unknown_part", quantity: 1, role: "x", reason: "y" }],
    });
    const result = await suggestParts(description, { config, client });
    expect(result.source).toBe("ai");
    expect(result.parts).toEqual([]);
    expect(result.droppedCount).toBe(1);
  });

  it("falls back to demo suggestions on malformed JSON", async () => {
    const { client } = fakeClient(async () => response("{ parts: [ oops"));
    const result = await suggestParts(description, { config, client });
    expect(result.source).toBe("demo");
    expect(result.fallbackReason).toBe("bad-response");
    expect(result.parts.some((p) => p.key === "hc_sr04")).toBe(true);
  });

  it("falls back when the JSON has the wrong shape or the answer was cut off", async () => {
    const wrongShape = reply({ summary: "no parts array" });
    expect((await suggestParts(description, { config, client: wrongShape.client })).fallbackReason).toBe(
      "bad-response",
    );
    const cutOff = fakeClient(async () => response('{"parts": [', "MAX_TOKENS"));
    expect((await suggestParts(description, { config, client: cutOff.client })).fallbackReason).toBe(
      "bad-response",
    );
  });

  it("falls back on blocked responses", async () => {
    const promptBlocked = fakeClient(async () => ({
      candidates: [],
      promptFeedback: { blockReason: "SAFETY" },
    }));
    expect(
      (await suggestParts(description, { config, client: promptBlocked.client })).fallbackReason,
    ).toBe("blocked");
    const answerBlocked = fakeClient(async () => response(undefined, "SAFETY"));
    expect(
      (await suggestParts(description, { config, client: answerBlocked.client })).fallbackReason,
    ).toBe("blocked");
  });

  it("falls back on empty responses", async () => {
    const { client } = fakeClient(async () => response("   "));
    const result = await suggestParts(description, { config, client });
    expect(result.source).toBe("demo");
    expect(result.fallbackReason).toBe("empty");
  });

  it("falls back to demo suggestions on a network error", async () => {
    const { client } = fakeClient(async () => {
      throw new TypeError("Failed to fetch");
    });
    const result = await suggestParts(description, { config, client });
    expect(result.source).toBe("demo");
    expect(result.fallbackReason).toBe("network");
    expect(result.parts.length).toBeGreaterThan(0);
  });

  it("uses demo suggestions without calling the API when the key is missing", async () => {
    const { client, spy } = reply({ language: "en", summary: "", parts: [] });
    const result = await suggestParts(description, { config: noKey, client });
    expect(spy).not.toHaveBeenCalled();
    expect(result.source).toBe("demo");
    expect(result.fallbackReason).toBe("missing-key");
  });

  it("reports the free-tier limit (429 / RESOURCE_EXHAUSTED) and falls back", async () => {
    const { client, spy } = fakeClient(async () => {
      throw apiError(
        429,
        '{"error":{"code":429,"message":"You exceeded your current quota","status":"RESOURCE_EXHAUSTED"}}',
      );
    });
    const result = await suggestParts(description, { config, client });
    expect(spy).toHaveBeenCalledTimes(1);
    expect(result.source).toBe("demo");
    expect(result.fallbackReason).toBe("rate-limit");
  });

  it("maps invalid keys and other API errors to clear fallback reasons", async () => {
    const cases: [ApiError, string][] = [
      [apiError(400, '{"error":{"message":"API key not valid. Please pass a valid API key.","status":"INVALID_ARGUMENT","details":[{"reason":"API_KEY_INVALID"}]}}'), "invalid-key"],
      [apiError(403, '{"error":{"status":"PERMISSION_DENIED"}}'), "permission"],
      [apiError(404, '{"error":{"message":"models/x is not found","status":"NOT_FOUND"}}'), "bad-request"],
      [apiError(503, '{"error":{"status":"UNAVAILABLE"}}'), "unavailable"],
    ];
    for (const [error, reason] of cases) {
      const { client } = fakeClient(async () => {
        throw error;
      });
      expect((await suggestParts(description, { config, client })).fallbackReason).toBe(reason);
    }
  });

  it("times out a request that never answers", async () => {
    const { client } = fakeClient(
      (params) =>
        new Promise((_resolve, reject) =>
          params.config?.abortSignal?.addEventListener("abort", () =>
            reject(new DOMException("The operation was aborted.", "AbortError")),
          ),
        ),
    );
    const result = await suggestParts(description, { config: { ...config, timeoutMs: 20 }, client });
    expect(result.source).toBe("demo");
    expect(result.fallbackReason).toBe("timeout");
  });

  it("sends example projects to the AI when a key is set, and uses their local results otherwise", async () => {
    const example = exampleProjects.find((e) => e.id === "weather-station")!;
    const { client, spy } = reply({
      language: "ar",
      summary: "ملخص",
      parts: [{ key: "esp32_devkit_v1", quantity: 1, role: "تحكم", reason: "واي فاي" }],
    });
    const ai = await suggestParts(example.description, { config, client });
    expect(spy).toHaveBeenCalledTimes(1);
    expect(ai.source).toBe("ai");
    expect(ai.language).toBe("ar");

    const local = await suggestParts(example.description, { config: noKey });
    expect(local.source).toBe("demo");
    expect(local.parts).toEqual(example.parts);
    expect(local.summary).toBe(example.summary);
  });
});

describe("AI request contract", () => {
  it("restricts part keys to the catalog in the response schema", () => {
    const schema = buildSchema();
    expect(schema.properties.parts.items.properties.key.enum).toEqual(
      componentCatalog.map((item) => item.key),
    );
    expect(buildSystemPrompt()).toContain("Use only keys from the catalog");
  });

  it("rejects responses that are not objects with a parts array", () => {
    expect(validateAiSuggestions(null, description)).toBeNull();
    expect(validateAiSuggestions([], description)).toBeNull();
    expect(validateAiSuggestions({ parts: "x" }, description)).toBeNull();
  });
});

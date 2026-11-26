/// <reference types="@testing-library/jest-dom/vitest" />
import { beforeEach, expect } from "vitest";
import * as matchers from "@testing-library/jest-dom/matchers";
import { clearAiCache } from "@/lib/ai/cache";

expect.extend(matchers);

// The AI demo cache survives "Reset demo" by design; tests start from an empty cache.
beforeEach(() => clearAiCache());

Object.defineProperty(window, "scrollTo", {
  writable: true,
  value: () => {},
});

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
});

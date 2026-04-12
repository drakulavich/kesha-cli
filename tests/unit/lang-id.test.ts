import { describe, test, expect } from "bun:test";
import { pickTopLanguage } from "../../src/lang-id";

const LABELS = ["en", "es", "fr", "de", "zh"];

describe("pickTopLanguage", () => {
  test("returns the language with highest probability", () => {
    const probs = new Float32Array([0.1, 0.6, 0.2, 0.05, 0.05]);
    const result = pickTopLanguage(probs, LABELS);
    expect(result.code).toBe("es");
    expect(result.confidence).toBeCloseTo(0.6);
  });

  test("returns first label when first has highest probability", () => {
    const probs = new Float32Array([0.9, 0.05, 0.02, 0.02, 0.01]);
    const result = pickTopLanguage(probs, LABELS);
    expect(result.code).toBe("en");
    expect(result.confidence).toBeCloseTo(0.9);
  });

  test("returns last label when last has highest probability", () => {
    const probs = new Float32Array([0.05, 0.05, 0.1, 0.1, 0.7]);
    const result = pickTopLanguage(probs, LABELS);
    expect(result.code).toBe("zh");
    expect(result.confidence).toBeCloseTo(0.7);
  });

  test("handles all-zero probabilities (returns first label)", () => {
    const probs = new Float32Array([0.0, 0.0, 0.0, 0.0, 0.0]);
    const result = pickTopLanguage(probs, LABELS);
    expect(result.code).toBe("en");
    expect(result.confidence).toBe(0.0);
  });

  test("handles single-element array", () => {
    const probs = new Float32Array([1.0]);
    const result = pickTopLanguage(probs, ["en"]);
    expect(result.code).toBe("en");
    expect(result.confidence).toBe(1.0);
  });
});

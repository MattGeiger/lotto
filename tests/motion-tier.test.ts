import { describe, expect, it } from "vitest";

import { classifyMotionTier, isMotionTier } from "@/lib/motion-tier";

describe("motion tier classification", () => {
  it("returns off when user prefers reduced motion", () => {
    expect(
      classifyMotionTier({
        prefersReducedMotion: true,
        avgFrameMs: 16,
        p95FrameMs: 18,
        hardwareConcurrency: 8,
        deviceMemoryGb: 8,
      }),
    ).toBe("off");
  });

  it("returns full for fast frame timings on capable devices", () => {
    expect(
      classifyMotionTier({
        prefersReducedMotion: false,
        avgFrameMs: 16.5,
        p95FrameMs: 20,
        hardwareConcurrency: 8,
        deviceMemoryGb: 8,
      }),
    ).toBe("full");
  });

  it("returns simple for moderate frame timings", () => {
    expect(
      classifyMotionTier({
        prefersReducedMotion: false,
        avgFrameMs: 28,
        p95FrameMs: 44,
        hardwareConcurrency: 4,
        deviceMemoryGb: 4,
      }),
    ).toBe("simple");
  });

  it("returns off for severe frame timing degradation", () => {
    expect(
      classifyMotionTier({
        prefersReducedMotion: false,
        avgFrameMs: 45,
        p95FrameMs: 92,
        hardwareConcurrency: 4,
        deviceMemoryGb: 4,
      }),
    ).toBe("off");
  });

  it("returns simple for low-capability hints without frame stats", () => {
    expect(
      classifyMotionTier({
        prefersReducedMotion: false,
        avgFrameMs: null,
        p95FrameMs: null,
        hardwareConcurrency: 2,
        deviceMemoryGb: 2,
      }),
    ).toBe("simple");
  });

  it("identifies supported stored tier values", () => {
    expect(isMotionTier("full")).toBe(true);
    expect(isMotionTier("simple")).toBe(true);
    expect(isMotionTier("off")).toBe(true);
    expect(isMotionTier("unknown")).toBe(false);
    expect(isMotionTier(null)).toBe(false);
  });
});

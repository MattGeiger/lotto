import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const configPath = path.resolve(__dirname, "../next.config.ts");
const configSource = readFileSync(configPath, "utf-8");

describe("M3: Content Security Policy headers must be configured", () => {
  it("has an async headers function in next.config", () => {
    expect(configSource).toMatch(/async\s+headers\s*\(\)/);
  });

  it("includes Content-Security-Policy header with required directives", () => {
    expect(configSource).toContain("Content-Security-Policy");
    expect(configSource).toContain("script-src");
    expect(configSource).toContain("style-src");
    expect(configSource).toContain("connect-src");
    expect(configSource).toContain("frame-ancestors");
  });
});

import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const configPath = path.resolve(__dirname, "../next.config.ts");
const configSource = readFileSync(configPath, "utf-8");

describe("L5: production source maps must be explicitly disabled", () => {
  it("next.config explicitly sets productionBrowserSourceMaps to false", () => {
    expect(configSource).toContain("productionBrowserSourceMaps: false");
  });
});

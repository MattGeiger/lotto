import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("M5: next-auth version must be pinned exactly", () => {
  it("does not use caret or tilde range for next-auth", () => {
    const pkgPath = path.resolve(__dirname, "../package.json");
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
    const version = pkg.dependencies["next-auth"];

    expect(version).toBeDefined();
    expect(version).not.toMatch(/^[\^~]/);
  });

  it("specifies an exact version string", () => {
    const pkgPath = path.resolve(__dirname, "../package.json");
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
    const version = pkg.dependencies["next-auth"];

    // Should be a bare version like "5.0.0-beta.30", not a range
    expect(version).toMatch(/^\d+\.\d+\.\d+/);
  });
});

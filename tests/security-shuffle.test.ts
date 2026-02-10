import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("H1: shuffle must use cryptographically secure randomness", () => {
  it("file-based state-manager shuffle does not use Math.random", () => {
    const source = fs.readFileSync(
      path.resolve(__dirname, "../src/lib/state-manager.ts"),
      "utf-8",
    );

    // Extract the shuffle function body
    const shuffleMatch = source.match(
      /const shuffle\s*=\s*\(values[^)]*\)\s*=>\s*\{([\s\S]*?)\n\};/,
    );
    expect(shuffleMatch).not.toBeNull();
    const shuffleBody = shuffleMatch![1];

    expect(shuffleBody).not.toContain("Math.random");
    expect(shuffleBody).toContain("randomInt");
  });

  it("database state-manager shuffle does not use Math.random", () => {
    const source = fs.readFileSync(
      path.resolve(__dirname, "../src/lib/state-manager-db.ts"),
      "utf-8",
    );

    // Extract the shuffle function body
    const shuffleMatch = source.match(
      /const shuffle\s*=\s*\(values[^)]*\)\s*=>\s*\{([\s\S]*?)\n\};/,
    );
    expect(shuffleMatch).not.toBeNull();
    const shuffleBody = shuffleMatch![1];

    expect(shuffleBody).not.toContain("Math.random");
    expect(shuffleBody).toContain("randomInt");
  });

  it("both modules import randomInt from node:crypto", () => {
    const fileSource = fs.readFileSync(
      path.resolve(__dirname, "../src/lib/state-manager.ts"),
      "utf-8",
    );
    const dbSource = fs.readFileSync(
      path.resolve(__dirname, "../src/lib/state-manager-db.ts"),
      "utf-8",
    );

    expect(fileSource).toMatch(/import.*randomInt.*from\s*["']node:crypto["']/);
    expect(dbSource).toMatch(/import.*randomInt.*from\s*["']node:crypto["']/);
  });
});

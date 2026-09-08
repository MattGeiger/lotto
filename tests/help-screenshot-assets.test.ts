// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Matt Geiger, Temple Consulting, LLC.

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";

import { HELP_SCREENSHOT_SIZES } from "@/lib/help-screenshot-manifest";

const repoRoot = process.cwd();
const guidesDir = join(repoRoot, "docs", "user-guides");
const publicDir = join(repoRoot, "public");
const helpImagePattern = /!\[[^\]]*\]\((\/help-screenshots\/[^)]+\.(?:png|webp))\)/g;

/** Every `/help-screenshots/...` path referenced by a guide, light variants only. */
function referencedHelpImages() {
  const paths = new Set<string>();

  for (const filename of readdirSync(guidesDir).filter((name) => name.endsWith(".md"))) {
    const guide = readFileSync(join(guidesDir, filename), "utf8");
    for (const match of guide.matchAll(helpImagePattern)) paths.add(match[1]);
  }

  return [...paths].sort();
}

const manifestName = (publicPath: string) =>
  publicPath.slice("/help-screenshots/".length).replace(/\.(?:png|webp)$/, "");

describe("Help screenshot assets", () => {
  it("ships every referenced image with its automatic dark-mode partner", () => {
    const missing: string[] = [];

    for (const filename of readdirSync(guidesDir).filter((name) => name.endsWith(".md"))) {
      const guide = readFileSync(join(guidesDir, filename), "utf8");

      for (const match of guide.matchAll(helpImagePattern)) {
        const publicPath = match[1];
        const lightPath = join(publicDir, publicPath.slice(1));
        const darkPath = lightPath.replace(/(\.(?:png|webp))$/, "-dark$1");

        if (!existsSync(lightPath)) missing.push(`${filename}: ${publicPath}`);
        if (!existsSync(darkPath)) {
          missing.push(`${filename}: ${publicPath.replace(/(\.(?:png|webp))$/, "-dark$1")}`);
        }
      }
    }

    expect(missing).toEqual([]);
  });

  it("describes every referenced image in the render manifest", () => {
    const unlisted = referencedHelpImages().filter(
      (publicPath) => !(manifestName(publicPath) in HELP_SCREENSHOT_SIZES),
    );

    // Without a manifest entry the renderer has no capture size to work from
    // and the image falls back to filling the guide column, which is the
    // over-scaling this manifest exists to prevent.
    expect(unlisted).toEqual([]);
  });

  it("keeps the manifest's recorded dimensions equal to the stored assets", async () => {
    const drifted: string[] = [];

    for (const [name, size] of Object.entries(HELP_SCREENSHOT_SIZES)) {
      const file = join(publicDir, "help-screenshots", `${name}.webp`);
      if (!existsSync(file)) {
        drifted.push(`${name}: no stored asset`);
        continue;
      }

      const { width, height } = await sharp(file).metadata();
      if (width !== size.pixelWidth || height !== size.pixelHeight) {
        drifted.push(
          `${name}: manifest says ${size.pixelWidth}x${size.pixelHeight}, asset is ${width}x${height}`,
        );
      }
    }

    // A stale manifest silently mis-sizes an image, so regenerating assets
    // without regenerating the manifest has to fail loudly.
    expect(drifted).toEqual([]);
  });

  it("captures phone surfaces at 2x so they render at a phone's own width", async () => {
    const phoneCaptures = ["arcade", "arcade-game", "client-ticket", "themes"];
    const wrong: string[] = [];

    for (const name of phoneCaptures) {
      const size = HELP_SCREENSHOT_SIZES[name];
      if (!size) {
        wrong.push(`${name}: missing from the manifest`);
        continue;
      }

      const cssWidth = size.pixelWidth / size.deviceScaleFactor;
      if (size.deviceScaleFactor !== 2) wrong.push(`${name}: captured at ${size.deviceScaleFactor}x`);
      if (cssWidth !== 375) wrong.push(`${name}: ${cssWidth}pt wide, expected a 375pt phone`);
    }

    expect(wrong).toEqual([]);
  });

  it("keeps the production Help catalog free of beta-only workflow copy", () => {
    const matches: string[] = [];

    for (const filename of readdirSync(guidesDir).filter((name) => name.endsWith(".md"))) {
      const guide = readFileSync(join(guidesDir, filename), "utf8");
      if (/beta|realtime=(?:poll|observe)|admin\/realtime/i.test(guide)) {
        matches.push(filename);
      }
    }

    expect(matches).toEqual([]);
  });

  it("keeps announcement instructions and formatting in one guide", () => {
    expect(existsSync(join(guidesDir, "09-markdown-formatting.md"))).toBe(false);
    expect(readFileSync(join(guidesDir, "10-announcements.md"), "utf8")).toContain(
      "# Announcements & Formatting",
    );
  });
});

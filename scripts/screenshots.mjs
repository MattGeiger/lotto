// Regenerates the README screenshots in docs/screenshots/ and the light/dark
// in-app Help pairs in public/help-screenshots/ by driving the installed Google
// Chrome via puppeteer-core (no bundled browser download).
//
// Usage:
//   1. Start the app:  npm run dev   (or `npm start` after a build)
//   2. Run:            npm run screenshots
//
// Env overrides:
//   SCREENSHOT_BASE_URL  base URL of the running app (default http://localhost:3000)
//   CHROME_PATH          path to the Chrome/Chromium binary
//   SCREENSHOT_NAMES     optional comma-separated output names to regenerate
//
// Each shot can pin a theme (light/dark) and a UI language; both are applied via
// the same storage keys the app itself uses (next-themes `theme`, and the
// language-context `display-language` / `display-language-session`) so the
// screenshots match what a real user with those settings would see.

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";
import sharp from "sharp";

const BASE_URL = process.env.SCREENSHOT_BASE_URL ?? "http://localhost:3000";
const CHROME_PATH =
  process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = join(REPO_ROOT, "docs", "screenshots");
const HELP_OUT_DIR = join(REPO_ROOT, "public", "help-screenshots");
const MANIFEST_PATH = join(REPO_ROOT, "src", "lib", "help-screenshot-manifest.ts");
const MANIFEST_HEADER = `// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Matt Geiger, Temple Consulting, LLC.
//
// GENERATED FILE — do not edit by hand. Regenerate with \`npm run screenshots\`
// (scripts/screenshots.mjs), which writes this from the capture geometry in
// HELP_SHOT_BASES plus the dimensions of the stored assets.
//
// Help screenshots render at 1x their captured CSS size, capped by the guide
// column. Dividing pixelWidth by deviceScaleFactor recovers that CSS size; see
// docs/HELP_SYSTEM.md. Dark-mode siblings share their light entry.

export type HelpScreenshotSize = {
  /** Intrinsic width of the stored asset, in image pixels. */
  pixelWidth: number;
  /** Intrinsic height of the stored asset, in image pixels. */
  pixelHeight: number;
  /** Device-pixel ratio the capture ran at. */
  deviceScaleFactor: number;
};
`;
const REQUESTED_NAMES = new Set(
  (process.env.SCREENSHOT_NAMES ?? "")
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean),
);

/** @typedef {"appearance"|"home-ticket"|"themes"|"admin-advanced"|"admin-status-lists"|"admin-status-revert"|"feed-history"|"feed-setup"|"announcement"|"announcement-code"|"translation"|"translation-ai-config"|"translation-management"|"appearance-help"|"appearance-wizard"|"appearance-step-identity"|"appearance-step-logos"|"appearance-step-colors"|"appearance-step-staff"|"appearance-step-inventory"|"appearance-step-review"|"arcade-game"|"login-code"} Preparation */
/** @typedef {{name:string,route:string,width:number,height:number,theme?:"light"|"dark",lang?:string,prepare?:Preparation,outDir?:string,target?:string,format?:"png"|"webp",deviceScaleFactor?:number,isMobile?:boolean,hasTouch?:boolean}} Shot */

/** @type {Shot[]} */
const SHOTS = [
  // Light (default English)
  { name: "login", route: "/login", width: 1440, height: 900 },
  { name: "client-ticket", route: "/", width: 1440, height: 900, prepare: "home-ticket" },
  { name: "admin-dashboard", route: "/admin", width: 1440, height: 900 },
  { name: "display-board", route: "/display", width: 1600, height: 900 },
  { name: "inventory", route: "/inventory", width: 1440, height: 1000 },
  { name: "arcade", route: "/arcade", width: 1440, height: 950 },
  { name: "admin-appearance", route: "/admin", width: 1440, height: 1000, prepare: "appearance" },
  { name: "help", route: "/help", width: 1440, height: 1000 },
  // Dark mode
  { name: "display-board-dark", route: "/display", width: 1600, height: 900, theme: "dark" },
  { name: "login-dark", route: "/login", width: 1440, height: 900, theme: "dark" },
  // Localizations
  { name: "display-board-zh", route: "/display", width: 1600, height: 900, lang: "zh" },
  { name: "display-board-ru", route: "/display", width: 1600, height: 900, lang: "ru" },
  { name: "display-board-ar", route: "/display", width: 1600, height: 900, lang: "ar" },
];

/** @type {Omit<Shot, "theme"|"outDir">[]} */
const HELP_SHOT_BASES = [
  { name: "staff-dashboard", route: "/admin", width: 1280, height: 800 },
  { name: "display-board", route: "/display", width: 1280, height: 720 },
  { name: "client-ticket", route: "/", width: 375, height: 812, deviceScaleFactor: 2, isMobile: true, hasTouch: true, prepare: "home-ticket" },
  { name: "inventory", route: "/inventory", width: 1280, height: 820 },
  { name: "languages", route: "/display", width: 1280, height: 720, lang: "ar" },
  { name: "themes", route: "/", width: 375, height: 812, deviceScaleFactor: 2, isMobile: true, hasTouch: true, prepare: "themes" },
  { name: "arcade", route: "/arcade", width: 375, height: 812, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  { name: "arcade-game", route: "/arcade/snake", width: 375, height: 812, deviceScaleFactor: 2, isMobile: true, hasTouch: true, prepare: "arcade-game" },
  { name: "sign-in-code", route: "/login", width: 1100, height: 760, prepare: "login-code" },
  {
    name: "ticket-status-lists",
    route: "/admin",
    width: 1280,
    height: 900,
    prepare: "admin-status-lists",
    target: "[data-screenshot-target='status-lists']",
  },
  {
    name: "ticket-status-revert",
    route: "/admin",
    width: 1280,
    height: 900,
    prepare: "admin-status-revert",
    target: "[role='alertdialog']",
  },
  {
    name: "feed-history",
    route: "/admin",
    width: 1280,
    height: 900,
    prepare: "feed-history",
    target: "[data-screenshot-target='feed-history']",
  },
  {
    name: "feed-setup",
    route: "/admin",
    width: 1280,
    height: 900,
    prepare: "feed-setup",
    target: "[role='dialog']",
  },
  { name: "advanced-section", route: "/admin", width: 1280, height: 900, prepare: "admin-advanced" },
  {
    name: "announcement-editor",
    route: "/admin",
    width: 1280,
    height: 900,
    prepare: "announcement",
    target: "[data-screenshot-target='announcement']",
  },
  {
    name: "announcement-formatting",
    route: "/admin",
    width: 1280,
    height: 900,
    prepare: "announcement-code",
    target: "[data-screenshot-target='announcement']",
  },
  {
    name: "translation",
    route: "/admin",
    width: 1280,
    height: 900,
    prepare: "translation",
    target: "[data-screenshot-target='translation']",
  },
  {
    name: "ai-configuration",
    route: "/admin",
    width: 1280,
    height: 900,
    prepare: "translation-ai-config",
    target: "[data-screenshot-target='translation']",
  },
  {
    name: "translation-management",
    route: "/admin",
    width: 1280,
    height: 900,
    deviceScaleFactor: 2,
    prepare: "translation-management",
    target: "[data-screenshot-target='translation']",
  },
  {
    name: "appearance",
    route: "/admin",
    width: 1280,
    height: 900,
    prepare: "appearance-help",
  },
  {
    name: "appearance-wizard",
    route: "/admin",
    width: 1280,
    height: 900,
    prepare: "appearance-wizard",
    target: "[role='dialog']",
  },
  { name: "appearance-identity", route: "/admin", width: 1280, height: 900, prepare: "appearance-step-identity", target: "[role='dialog']" },
  { name: "appearance-logos", route: "/admin", width: 1280, height: 900, prepare: "appearance-step-logos", target: "[role='dialog']" },
  { name: "appearance-colors", route: "/admin", width: 1280, height: 900, prepare: "appearance-step-colors", target: "[role='dialog']" },
  { name: "appearance-staff", route: "/admin", width: 1280, height: 900, prepare: "appearance-step-staff", target: "[role='dialog']" },
  { name: "appearance-inventory", route: "/admin", width: 1280, height: 900, prepare: "appearance-step-inventory", target: "[role='dialog']" },
  { name: "appearance-review", route: "/admin", width: 1280, height: 900, prepare: "appearance-step-review", target: "[role='dialog']" },
];

for (const base of HELP_SHOT_BASES) {
  SHOTS.push(
    { ...base, outDir: HELP_OUT_DIR, theme: "light", format: "webp" },
    { ...base, name: `${base.name}-dark`, outDir: HELP_OUT_DIR, theme: "dark", format: "webp" },
  );
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// A Help screenshot renders at 1x its captured CSS size, capped by the guide
// column (docs/HELP_SYSTEM.md). The markdown renderer cannot infer a capture's
// CSS size from the stored file — a 750px-wide asset is a 375pt phone at 2x,
// not a 750pt window — so the capture geometry is written out here as the
// single source of truth the renderer and its tests both read.
async function writeHelpScreenshotManifest() {
  const entries = [];

  for (const base of [...HELP_SHOT_BASES].sort((left, right) => left.name.localeCompare(right.name))) {
    const file = join(HELP_OUT_DIR, `${base.name}.webp`);

    if (!existsSync(file)) {
      console.warn(`… no ${base.name}.webp on disk; leaving it out of the manifest`);
      continue;
    }

    const { width, height } = await sharp(file).metadata();
    entries.push({
      name: base.name,
      pixelWidth: width,
      pixelHeight: height,
      deviceScaleFactor: base.deviceScaleFactor ?? 1,
    });
  }

  const rows = entries
    .map(
      (entry) =>
        `  "${entry.name}": { pixelWidth: ${entry.pixelWidth}, pixelHeight: ${entry.pixelHeight}, deviceScaleFactor: ${entry.deviceScaleFactor} },`,
    )
    .join("\n");

  writeFileSync(
    MANIFEST_PATH,
    `${MANIFEST_HEADER}\nexport const HELP_SCREENSHOT_SIZES: Record<string, HelpScreenshotSize> = {\n${rows}\n};\n`,
    "utf8",
  );
  console.log(`✓ help-screenshot-manifest.ts (${entries.length} captures)`);
}

const APPEARANCE_STEP_INDEX = {
  "appearance-wizard": 0,
  "appearance-step-identity": 1,
  "appearance-step-logos": 2,
  "appearance-step-colors": 3,
  "appearance-step-staff": 4,
  "appearance-step-inventory": 5,
  "appearance-step-review": 6,
};

async function run() {
  mkdirSync(OUT_DIR, { recursive: true });
  mkdirSync(HELP_OUT_DIR, { recursive: true });
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: "new",
    args: ["--hide-scrollbars", "--disable-gpu"],
  });

  try {
    for (const shot of SHOTS) {
      if (REQUESTED_NAMES.size > 0 && !REQUESTED_NAMES.has(shot.name)) continue;
      const theme = shot.theme ?? "light";
      const lang = shot.lang ?? "en";
      const page = await browser.newPage();
      await page.setViewport({
        width: shot.width,
        height: shot.height,
        deviceScaleFactor: shot.deviceScaleFactor ?? 1,
        isMobile: shot.isMobile ?? false,
        hasTouch: shot.hasTouch ?? false,
      });
      await page.emulateMediaFeatures([{ name: "prefers-color-scheme", value: theme }]);

      if (
        ["appearance", "appearance-help"].includes(shot.prepare ?? "") ||
        Object.hasOwn(APPEARANCE_STEP_INDEX, shot.prepare ?? "")
      ) {
        await page.setRequestInterception(true);
        page.on("request", (request) => {
          if (new URL(request.url()).pathname === "/api/brand-config") {
            void request.respond({
              status: 200,
              contentType: "application/json",
              body: JSON.stringify({ configurations: [], activeId: null }),
            });
            return;
          }
          void request.continue();
        });
      }

      // Visit once to get an origin, seed the same storage keys the app uses,
      // then reload so the app boots with the chosen theme + language.
      await page.goto(`${BASE_URL}${shot.route}`, { waitUntil: "domcontentloaded" });
      await page.evaluate(
        (t, l, preparation) => {
          localStorage.setItem("theme", t);
          localStorage.setItem("display-language", l);
          sessionStorage.setItem("display-language-session", l);
          if (preparation === "home-ticket" || preparation === "themes") {
            const now = Date.now();
            localStorage.setItem("homepage-ticket-selection-v1", JSON.stringify({
              ticketNumber: 25,
              savedAt: now,
              expiresAt: now + 8 * 60 * 60 * 1000,
            }));
          }
          if (preparation === "announcement") {
            localStorage.setItem("lotto:announcement-draft", JSON.stringify({
              enabled: true,
              markdown: "## Pantry update\n\nFresh produce is available **while supplies last**.\n\n- Check today's inventory\n- Keep your ticket nearby",
              startsAt: null,
              endsAt: null,
              updatedAt: 0,
            }));
          }
        },
        theme,
        lang,
        shot.prepare,
      );
      await page.reload({ waitUntil: "networkidle2" });
      // Let polling, the inventory fetch, and language/scramble transitions settle.
      await wait(4000);

      // Screenshot the product rather than development-only controls. These are
      // absent from production but intentionally present during `npm run dev`.
      await page.evaluate(() => {
        document.querySelectorAll("nextjs-portal").forEach((portal) => {
          portal.style.display = "none";
        });
        const palette = document.querySelector('[aria-label="Open palette calibration"]');
        if (palette instanceof HTMLElement) palette.style.display = "none";
      });

      const openAdvanced = async () => {
        await page.evaluate(() => {
          const advanced = Array.from(document.querySelectorAll("button")).find((button) =>
            button.textContent?.trim().startsWith("Advanced"),
          );
          advanced?.click();
        });
        await page.waitForFunction(() => document.body.textContent?.includes("Set operating hours"));
        await wait(500);
      };

      const clickButton = async (label, scope = "body") => {
        const buttons = await page.$$(`${scope} button`);
        for (const button of buttons) {
          const text = await button.evaluate((element) => element.textContent ?? "");
          if (text.includes(label)) {
            await button.click();
            return;
          }
        }
        throw new Error(`Button not found: ${label} in ${scope}`);
      };

      const stabilizeActiveTabPane = async (textMarker) => {
        await page.evaluate((marker) => {
          const style = document.createElement("style");
          style.textContent =
            "[data-screenshot-target='translation'], [data-screenshot-target='translation'] * { filter: none !important; }";
          document.head.append(style);
          const content = Array.from(document.querySelectorAll("p")).find((element) =>
            element.textContent?.includes(marker),
          );
          const activeContent = content?.closest("[data-slot='tabs-content']");
          if (activeContent instanceof HTMLElement) {
            activeContent.style.filter = "none";
            activeContent.style.opacity = "1";
            activeContent.style.transform = "none";
            activeContent.style.transition = "none";
          }
          let pane = content;
          while (
            pane &&
            !(pane.classList.contains("w-full") && pane.classList.contains("shrink-0"))
          ) {
            pane = pane.parentElement;
          }
          const rail = pane?.parentElement;
          if (!(pane instanceof HTMLElement) || !(rail instanceof HTMLElement)) return;
          for (const sibling of rail.children) {
            if (sibling instanceof HTMLElement && sibling !== pane) sibling.style.display = "none";
          }
          rail.style.transform = "none";
          rail.style.marginInline = "0";
          pane.style.paddingInline = "0";
        }, textMarker);
      };

      const markCard = async (label, targetName) => {
        await page.evaluate((text, name) => {
          const card = Array.from(document.querySelectorAll("[data-slot='card']"))
            .filter((element) => element.textContent?.includes(text))
            .sort((left, right) =>
              (left.textContent?.length ?? 0) - (right.textContent?.length ?? 0),
            )[0];
          if (card instanceof HTMLElement) card.dataset.screenshotTarget = name;
        }, label, targetName);
        await page.waitForSelector(`[data-screenshot-target='${targetName}']`, { visible: true });
      };

      if (shot.prepare === "login-code") {
        await page.click("#login-tabs-trigger-otp");
        await wait(500);
      }

      if (shot.prepare === "home-ticket") {
        await page.evaluate(() => {
          const label = Array.from(document.querySelectorAll("p")).find(
            (element) => element.textContent?.trim() === "YOUR TICKET NUMBER",
          );
          const panel = label?.parentElement?.parentElement?.parentElement;
          if (panel instanceof HTMLElement) {
            panel.dataset.screenshotTarget = "client-ticket";
            // The page bottoms out before this reaches the top of the viewport,
            // so the capture keeps a sliver of the Now Serving card above it.
            // That is what a phone actually shows at the end of the scroll.
            panel.scrollIntoView({ block: "start", inline: "nearest" });
          }
        });
        await page.waitForSelector("[data-screenshot-target='client-ticket']", { visible: true });
        await wait(500);
      }

      if (shot.prepare === "admin-advanced") {
        await openAdvanced();
        await page.evaluate(() => {
          const advanced = Array.from(document.querySelectorAll("button")).find((button) =>
            button.textContent?.trim().startsWith("Advanced"),
          );
          advanced?.scrollIntoView({ block: "start", inline: "nearest" });
        });
        await wait(500);
      }

      if (shot.prepare === "admin-status-lists" || shot.prepare === "admin-status-revert") {
        await markCard("Live State", "status-lists");
        await page.$eval("[data-screenshot-target='status-lists']", (element) =>
          element.scrollIntoView({ block: "center", inline: "nearest" }),
        );
        await wait(500);
        if (shot.prepare === "admin-status-revert") {
          const trigger = await page.$("button[title^='Revert unclaimed ticket']");
          if (!trigger) throw new Error("No unclaimed ticket is available for the revert screenshot.");
          await trigger.click();
          await page.waitForSelector("[role='alertdialog']", { visible: true });
          await wait(500);
        }
      }

      if (shot.prepare === "feed-history" || shot.prepare === "feed-setup") {
        await markCard("History", "feed-history");
        await page.$eval("[data-screenshot-target='feed-history']", (element) =>
          element.scrollIntoView({ block: "center", inline: "nearest" }),
        );
        await wait(500);
        if (shot.prepare === "feed-setup") {
          await clickButton("Setup", "[data-screenshot-target='feed-history']");
          await page.waitForSelector("[role='dialog']", { visible: true });
          await wait(500);
        }
      }

      if (shot.prepare === "announcement" || shot.prepare === "announcement-code") {
        await openAdvanced();
        await markCard("Announcement", "announcement");
        await page.waitForSelector('[aria-label="Announcement message"]');
        if (shot.prepare === "announcement-code") {
          await clickButton("Edit code", "[data-screenshot-target='announcement']");
          await page.waitForSelector('textarea[aria-label="Announcement message"]', { visible: true });
          await page.$eval('textarea[aria-label="Announcement message"]', (textarea) => {
            const setter = Object.getOwnPropertyDescriptor(
              HTMLTextAreaElement.prototype,
              "value",
            )?.set;
            setter?.call(
              textarea,
              "## Pantry update\n\nFresh produce is available **while supplies last**.\n\n- Check today's inventory\n- Keep your ticket nearby",
            );
            textarea.dispatchEvent(new Event("input", { bubbles: true }));
          });
        }
        await wait(500);
      }

      if (
        shot.prepare === "translation" ||
        shot.prepare === "translation-ai-config" ||
        shot.prepare === "translation-management"
      ) {
        await openAdvanced();
        await markCard("Translation", "translation");
        if (shot.prepare === "translation-ai-config") {
          await clickButton("AI Configuration", "[data-screenshot-target='translation']");
          await wait(800);
          await stabilizeActiveTabPane("Configure AI providers");
        }
        if (shot.prepare === "translation-management") {
          await clickButton("Translation Management", "[data-screenshot-target='translation']");
          await wait(800);
          await stabilizeActiveTabPane("Review, correct, retry");
        }
      }

      if (shot.prepare === "appearance" || shot.prepare === "appearance-help") {
        await openAdvanced();
        await page.waitForSelector("[data-appearance-preview]", { visible: true });
        await page.evaluate(() => {
          const manager = document.querySelector("[data-appearance-manager]");
          const preview = document.querySelector("[data-appearance-preview]");
          const target = manager?.parentElement;
          if (target instanceof HTMLElement && target.contains(preview)) {
            target.dataset.screenshotTarget = "appearance";
          }
        });
        await page.$eval("[data-appearance-preview]", (element) =>
          element.scrollIntoView({ block: "center", inline: "nearest" }),
        );
        await wait(800);
      }

      if (Object.hasOwn(APPEARANCE_STEP_INDEX, shot.prepare ?? "")) {
        await openAdvanced();
        await page.waitForSelector("[data-appearance-manager]", { visible: true });
        await page.evaluate(() => {
          const setupButton = Array.from(document.querySelectorAll("button")).find((button) =>
            ["Set up appearance", "New appearance"].includes(button.textContent?.trim() ?? ""),
          );
          setupButton?.click();
        });
        await page.waitForSelector("[role='dialog']", { visible: true });
        const targetStep = APPEARANCE_STEP_INDEX[shot.prepare];
        if (targetStep > 0) {
          await clickButton("Start from scratch", "[role='dialog']");
          await page.type("#appearance-config-id", "sample-organization");
          for (let step = 0; step < targetStep; step += 1) {
            await clickButton("Next", "[role='dialog']");
            await wait(500);
          }
        }
        await wait(800);
      }

      if (shot.prepare === "arcade-game") {
        await page.click("button[aria-label='Start game']");
        await wait(700);
      }

      const format = shot.format ?? "png";
      const path = join(shot.outDir ?? OUT_DIR, `${shot.name}.${format}`);
      const screenshotOptions = {
        path,
        type: format,
        ...(format === "webp" ? { quality: 84 } : {}),
      };
      if (shot.target) {
        const target = await page.waitForSelector(shot.target, { visible: true });
        if (!target) throw new Error(`Screenshot target not found: ${shot.target}`);
        await target.screenshot(screenshotOptions);
      } else {
        await page.screenshot(screenshotOptions);
      }
      console.log(`✓ ${shot.name}.${format} (${theme}, ${lang})`);
      await page.close();
    }
  } finally {
    await browser.close();
  }

  // Always rebuild the manifest from what is on disk, even for a bounded
  // SCREENSHOT_NAMES run, so a partial refresh cannot leave it half-stale.
  await writeHelpScreenshotManifest();
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});

// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Matt Geiger, Temple Consulting, LLC.
//
// GENERATED FILE — do not edit by hand. Regenerate with `npm run screenshots`
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

export const HELP_SCREENSHOT_SIZES: Record<string, HelpScreenshotSize> = {
  "advanced-section": { pixelWidth: 1280, pixelHeight: 900, deviceScaleFactor: 1 },
  "ai-configuration": { pixelWidth: 1104, pixelHeight: 639, deviceScaleFactor: 1 },
  "announcement-editor": { pixelWidth: 1104, pixelHeight: 688, deviceScaleFactor: 1 },
  "announcement-formatting": { pixelWidth: 1104, pixelHeight: 678, deviceScaleFactor: 1 },
  "appearance": { pixelWidth: 1280, pixelHeight: 900, deviceScaleFactor: 1 },
  "appearance-colors": { pixelWidth: 620, pixelHeight: 644, deviceScaleFactor: 1 },
  "appearance-identity": { pixelWidth: 620, pixelHeight: 644, deviceScaleFactor: 1 },
  "appearance-inventory": { pixelWidth: 620, pixelHeight: 644, deviceScaleFactor: 1 },
  "appearance-logos": { pixelWidth: 620, pixelHeight: 644, deviceScaleFactor: 1 },
  "appearance-review": { pixelWidth: 620, pixelHeight: 644, deviceScaleFactor: 1 },
  "appearance-staff": { pixelWidth: 620, pixelHeight: 644, deviceScaleFactor: 1 },
  "appearance-wizard": { pixelWidth: 620, pixelHeight: 644, deviceScaleFactor: 1 },
  "arcade": { pixelWidth: 750, pixelHeight: 1624, deviceScaleFactor: 2 },
  "arcade-game": { pixelWidth: 750, pixelHeight: 1624, deviceScaleFactor: 2 },
  "client-ticket": { pixelWidth: 750, pixelHeight: 1624, deviceScaleFactor: 2 },
  "display-board": { pixelWidth: 1280, pixelHeight: 720, deviceScaleFactor: 1 },
  "feed-history": { pixelWidth: 360, pixelHeight: 741, deviceScaleFactor: 1 },
  "feed-setup": { pixelWidth: 512, pixelHeight: 462, deviceScaleFactor: 1 },
  "inventory": { pixelWidth: 1280, pixelHeight: 820, deviceScaleFactor: 1 },
  "languages": { pixelWidth: 1280, pixelHeight: 720, deviceScaleFactor: 1 },
  "sign-in-code": { pixelWidth: 1100, pixelHeight: 760, deviceScaleFactor: 1 },
  "staff-dashboard": { pixelWidth: 1280, pixelHeight: 800, deviceScaleFactor: 1 },
  "themes": { pixelWidth: 750, pixelHeight: 1624, deviceScaleFactor: 2 },
  "ticket-status-lists": { pixelWidth: 720, pixelHeight: 741, deviceScaleFactor: 1 },
  "ticket-status-revert": { pixelWidth: 512, pixelHeight: 178, deviceScaleFactor: 1 },
  "translation": { pixelWidth: 1104, pixelHeight: 662, deviceScaleFactor: 1 },
  "translation-management": { pixelWidth: 2208, pixelHeight: 1776, deviceScaleFactor: 2 },
};

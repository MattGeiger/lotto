// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 Matt Geiger, Temple Consulting, LLC.
//
// LOTTO — Line Order Transparency & Ticketing Organizer. Application code
// licensed under AGPL-3.0-or-later; see LICENSE. William Temple House branding
// is not covered by this license; see TRADEMARKS.md.

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
    expect(configSource).toContain("realtimeCanaryConnectHost");
    expect(configSource).toContain("LOTTO_REALTIME_CLIENT_CANARY");
    expect(configSource).toContain("LOTTO_REALTIME_SOURCE_CANARY");
    expect(configSource).toContain("getInventoryIntegration");
    expect(configSource).toContain("feedPublicInventoryHost");
    expect(configSource).toContain("frame-ancestors");
  });

  it("allows durable public Vercel Blob brand images in CSP and Next Image", () => {
    expect(configSource).toContain("https://*.public.blob.vercel-storage.com");
    expect(configSource).toContain('hostname: "*.public.blob.vercel-storage.com"');
  });
});

// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 Matt Geiger, Temple Consulting, LLC.

import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { BetaEnvironmentBanner } from "@/components/beta-environment-banner";
import { isBetaDeployment, isRealtimeEligibleDeployment } from "@/lib/deployment-environment";
import robots from "@/app/robots";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("beta deployment safety", () => {
  it("recognizes only the explicit beta environment value", () => {
    expect(isBetaDeployment({ LOTTO_DEPLOYMENT_ENVIRONMENT: "beta" })).toBe(true);
    expect(isBetaDeployment({ LOTTO_DEPLOYMENT_ENVIRONMENT: "production" })).toBe(false);
    expect(isBetaDeployment({ LOTTO_DEPLOYMENT_ENVIRONMENT: undefined })).toBe(false);
  });

  // The whole point of splitting the two predicates: production may use the
  // realtime hub, but must never inherit the sandbox presentation. Getting this
  // backwards would de-index williamtemple.app and tell every client that their
  // actions do not affect the real app.
  it("lets production use realtime without inheriting any sandbox behavior", () => {
    expect(isRealtimeEligibleDeployment({ LOTTO_DEPLOYMENT_ENVIRONMENT: "production" })).toBe(true);
    expect(isBetaDeployment({ LOTTO_DEPLOYMENT_ENVIRONMENT: "production" })).toBe(false);

    vi.stubEnv("LOTTO_DEPLOYMENT_ENVIRONMENT", "production");
    render(<BetaEnvironmentBanner />);
    expect(screen.queryByLabelText("Beta test environment")).toBeNull();
    expect(robots().rules).toMatchObject({ allow: "/" });
    expect(robots().rules).not.toHaveProperty("disallow");
  });

  it("keeps realtime eligibility fail-closed for unset and near-miss values", () => {
    expect(isRealtimeEligibleDeployment({ LOTTO_DEPLOYMENT_ENVIRONMENT: "beta" })).toBe(true);
    for (const value of [undefined, "", "prod", "Production", "PRODUCTION", "staging", " beta"]) {
      expect(isRealtimeEligibleDeployment({ LOTTO_DEPLOYMENT_ENVIRONMENT: value })).toBe(false);
    }
  });

  it("shows the warning banner only in beta", () => {
    vi.stubEnv("LOTTO_DEPLOYMENT_ENVIRONMENT", "beta");
    const { unmount } = render(<BetaEnvironmentBanner />);
    expect(screen.getByLabelText("Beta test environment")).toHaveTextContent(
      "Data and actions here do not affect the production LOTTO app.",
    );
    unmount();

    vi.stubEnv("LOTTO_DEPLOYMENT_ENVIRONMENT", "production");
    render(<BetaEnvironmentBanner />);
    expect(screen.queryByLabelText("Beta test environment")).not.toBeInTheDocument();
  });

  it("disallows crawling in beta and allows it otherwise", () => {
    vi.stubEnv("LOTTO_DEPLOYMENT_ENVIRONMENT", "beta");
    expect(robots()).toEqual({ rules: { userAgent: "*", disallow: "/" } });

    vi.stubEnv("LOTTO_DEPLOYMENT_ENVIRONMENT", "production");
    expect(robots()).toEqual({ rules: { userAgent: "*", allow: "/" } });
  });

  it("adds X-Robots-Tag only to the beta header policy", async () => {
    vi.stubEnv("LOTTO_DEPLOYMENT_ENVIRONMENT", "beta");
    vi.resetModules();
    const betaConfig = (await import("../next.config")).default;
    const betaHeaders = await betaConfig.headers?.();
    expect(betaHeaders?.[0]?.headers).toContainEqual({
      key: "X-Robots-Tag",
      value: "noindex, nofollow, noarchive, nosnippet",
    });

    vi.stubEnv("LOTTO_DEPLOYMENT_ENVIRONMENT", "production");
    vi.resetModules();
    const productionConfig = (await import("../next.config")).default;
    const productionHeaders = await productionConfig.headers?.();
    expect(
      productionHeaders?.[0]?.headers.some((header) => header.key === "X-Robots-Tag"),
    ).toBe(false);
  });

  // The realtime CSP was the last consumer still gated on beta alone. With it
  // beta-only, a production build with realtime enabled threw at build time,
  // and had it not thrown the connect-src would have omitted the hub and the
  // browser would have refused the WebSocket.
  it("emits the hub connect-src for a production realtime deployment", async () => {
    const realtimeEnvironment = {
      LOTTO_REALTIME_APPLICATION_ENABLED: "true",
      LOTTO_REALTIME_SOURCE_CANARY: "true",
      LOTTO_REALTIME_HUB_URL: "https://lotto-realtime-production.example.workers.dev",
      LOTTO_REALTIME_EXPECTED_HUB_HOST: "lotto-realtime-production.example.workers.dev",
      LOTTO_REALTIME_AGENCY_ID: "william-temple-house",
    };
    for (const [key, value] of Object.entries(realtimeEnvironment)) {
      vi.stubEnv(key, value);
    }

    vi.stubEnv("LOTTO_DEPLOYMENT_ENVIRONMENT", "production");
    vi.resetModules();
    const productionConfig = (await import("../next.config")).default;
    const headers = await productionConfig.headers?.();
    const csp = headers?.[0]?.headers.find((header) =>
      header.key === "Content-Security-Policy",
    )?.value;
    expect(csp).toContain("wss://lotto-realtime-production.example.workers.dev");
  });

  it("refuses to build a realtime CSP for an ineligible environment", async () => {
    for (const [key, value] of Object.entries({
      LOTTO_REALTIME_APPLICATION_ENABLED: "true",
      LOTTO_REALTIME_SOURCE_CANARY: "true",
      LOTTO_REALTIME_HUB_URL: "https://lotto-realtime-production.example.workers.dev",
      LOTTO_REALTIME_EXPECTED_HUB_HOST: "lotto-realtime-production.example.workers.dev",
    })) {
      vi.stubEnv(key, value);
    }

    vi.stubEnv("LOTTO_DEPLOYMENT_ENVIRONMENT", "staging");
    vi.resetModules();
    await expect(import("../next.config")).rejects.toThrow(
      /LOTTO_DEPLOYMENT_ENVIRONMENT to be exactly/,
    );
  });
});

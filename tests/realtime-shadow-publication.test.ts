// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 Matt Geiger, Temple Consulting, LLC.

import {
  publishPublicStateShadow,
  resolveShadowPublicationConfig,
} from "@/lib/realtime/shadow-publication";
import { toPublicRaffleState } from "@/lib/realtime/public-state-protocol";
import { defaultState } from "@/lib/state-types";

const enabledEnvironment = {
  LOTTO_DEPLOYMENT_ENVIRONMENT: "beta",
  LOTTO_REALTIME_SHADOW_PUBLISH: "true",
  LOTTO_REALTIME_HUB_URL: "https://lotto-realtime-beta.et2-geiger.workers.dev",
  LOTTO_REALTIME_AGENCY_ID: "william-temple-house",
  LOTTO_REALTIME_PUBLISH_TOKEN: "p".repeat(32),
  LOTTO_REALTIME_PUBLISH_TIMEOUT_MS: "1000",
};

describe("realtime shadow-publication configuration", () => {
  it("is disabled by default", () => {
    expect(resolveShadowPublicationConfig({})).toEqual({ enabled: false });
    expect(
      resolveShadowPublicationConfig({ LOTTO_REALTIME_SHADOW_PUBLISH: "false" }),
    ).toEqual({ enabled: false });
  });

  it("rejects ambiguous flags and non-beta activation", () => {
    expect(() =>
      resolveShadowPublicationConfig({ LOTTO_REALTIME_SHADOW_PUBLISH: "yes" }),
    ).toThrow(/must be either true or false/);
    // Fail-closed is preserved: only the two recognized values qualify, so an
    // unset or near-miss environment still refuses to publish.
    for (const value of [undefined, "", "prod", "Production", "staging"]) {
      expect(() =>
        resolveShadowPublicationConfig({
          ...enabledEnvironment,
          LOTTO_DEPLOYMENT_ENVIRONMENT: value,
        }),
      ).toThrow(/LOTTO_DEPLOYMENT_ENVIRONMENT to be exactly/);
    }
  });

  it("publishes from the production deployment environment", () => {
    expect(
      resolveShadowPublicationConfig({
        ...enabledEnvironment,
        LOTTO_DEPLOYMENT_ENVIRONMENT: "production",
      }),
    ).toMatchObject({ enabled: true });
  });

  it("requires an exact HTTPS beta host and bounded settings", () => {
    expect(resolveShadowPublicationConfig(enabledEnvironment)).toMatchObject({
      enabled: true,
      agencyId: "william-temple-house",
      timeoutMs: 1000,
    });
    expect(() =>
      resolveShadowPublicationConfig({
        ...enabledEnvironment,
        LOTTO_REALTIME_HUB_URL: "https://williamtemple.app",
      }),
    ).toThrow(/does not match/);
    expect(() =>
      resolveShadowPublicationConfig({
        ...enabledEnvironment,
        LOTTO_REALTIME_PUBLISH_TIMEOUT_MS: "6000",
      }),
    ).toThrow(/must be an integer/);
  });
});

describe("realtime shadow publisher", () => {
  const config = resolveShadowPublicationConfig(enabledEnvironment);
  if (!config.enabled) throw new Error("Expected enabled test configuration.");

  const intent = {
    publicationId: "965104d8-44a2-41b7-b7d0-d82d9c9d3a50",
    revision: 7,
    committedAt: "2026-09-01T12:00:00.000Z",
    checksum: `sha256:${"a".repeat(64)}`,
    state: toPublicRaffleState(structuredClone(defaultState)),
  };

  it("accepts stored and idempotent hub responses", async () => {
    const storedFetch = vi.fn().mockResolvedValue(new Response(null, { status: 202 }));
    const duplicateFetch = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));

    await expect(
      publishPublicStateShadow(config, intent, storedFetch),
    ).resolves.toEqual({ accepted: true, status: 202 });
    await expect(
      publishPublicStateShadow(config, intent, duplicateFetch),
    ).resolves.toEqual({ accepted: true, status: 200 });
  });

  it("returns bounded failure evidence without throwing", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(null, { status: 503 }));

    await expect(
      publishPublicStateShadow(config, intent, fetchImpl),
    ).resolves.toEqual({
      accepted: false,
      error: "Realtime hub returned HTTP 503.",
    });
  });

  it("aborts a stalled request at the configured deadline", async () => {
    vi.useFakeTimers();
    const fetchImpl = vi.fn((_url: URL | RequestInfo, request?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        request?.signal?.addEventListener("abort", () => {
          reject(new DOMException("aborted", "AbortError"));
        });
      }),
    );
    const promise = publishPublicStateShadow(
      { ...config, timeoutMs: 100 },
      intent,
      fetchImpl,
    );

    await vi.advanceTimersByTimeAsync(100);
    await expect(promise).resolves.toEqual({
      accepted: false,
      error: "Realtime hub timed out after 100ms.",
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it("does not copy network exception details into operational evidence", async () => {
    const fetchImpl = vi
      .fn()
      .mockRejectedValue(new Error("request failed with secret-value"));

    await expect(
      publishPublicStateShadow(config, intent, fetchImpl),
    ).resolves.toEqual({
      accepted: false,
      error: "Realtime publication failed.",
    });
  });
});

// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 Matt Geiger, Temple Consulting, LLC.
//
// LOTTO — Line Order Transparency & Ticketing Organizer. Application code
// licensed under AGPL-3.0-or-later; see LICENSE. William Temple House branding
// is not covered by this license; see TRADEMARKS.md.

import "server-only";

import { isRealtimeEligibleDeployment } from "@/lib/deployment-environment";

import {
  agencyIdSchema,
  publicStateEnvelopeSchema,
  type PublicRaffleState,
} from "./public-state-protocol";

const DEFAULT_BETA_HUB_HOST = "lotto-realtime-beta.et2-geiger.workers.dev";
const DEFAULT_TIMEOUT_MS = 1_500;
const MIN_TIMEOUT_MS = 100;
const MAX_TIMEOUT_MS = 5_000;
const MIN_TOKEN_LENGTH = 32;
const MAX_TOKEN_LENGTH = 512;

type Environment = Readonly<Record<string, string | undefined>>;

export type ShadowPublicationConfig =
  | { enabled: false }
  | {
      enabled: true;
      agencyId: string;
      hubOrigin: string;
      publishToken: string;
      timeoutMs: number;
    };

export type ShadowPublicationIntent = {
  publicationId: string;
  revision: number;
  committedAt: string;
  checksum: string;
  state: PublicRaffleState;
};

export type ShadowPublicationOutcome =
  | { accepted: true; status: 200 | 202 }
  | { accepted: false; error: string };

const required = (environment: Environment, name: string) => {
  const value = environment[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required when realtime shadow publication is enabled.`);
  }
  return value;
};

export const resolveShadowPublicationConfig = (
  environment: Environment = process.env,
): ShadowPublicationConfig => {
  const rawFlag = environment.LOTTO_REALTIME_SHADOW_PUBLISH?.trim().toLowerCase();
  if (!rawFlag || rawFlag === "false") return { enabled: false };
  if (rawFlag !== "true") {
    throw new Error("LOTTO_REALTIME_SHADOW_PUBLISH must be either true or false.");
  }
  if (!isRealtimeEligibleDeployment(environment)) {
    throw new Error(
      "Realtime shadow publication requires LOTTO_DEPLOYMENT_ENVIRONMENT to be exactly \"beta\" or \"production\".",
    );
  }

  const hubUrl = new URL(required(environment, "LOTTO_REALTIME_HUB_URL"));
  if (
    hubUrl.username ||
    hubUrl.password ||
    hubUrl.search ||
    hubUrl.hash ||
    (hubUrl.pathname !== "/" && hubUrl.pathname !== "")
  ) {
    throw new Error("LOTTO_REALTIME_HUB_URL must be an origin without credentials, path, query, or fragment.");
  }

  const isLocal = hubUrl.hostname === "localhost" || hubUrl.hostname === "127.0.0.1";
  if (!isLocal && hubUrl.protocol !== "https:") {
    throw new Error("Remote realtime shadow publication requires an HTTPS hub origin.");
  }
  if (isLocal && hubUrl.protocol !== "http:" && hubUrl.protocol !== "https:") {
    throw new Error("Local realtime shadow publication requires an HTTP or HTTPS hub origin.");
  }

  const expectedHost =
    environment.LOTTO_REALTIME_EXPECTED_HUB_HOST?.trim() ??
    DEFAULT_BETA_HUB_HOST;
  if (!isLocal && hubUrl.hostname !== expectedHost) {
    throw new Error(
      `Realtime hub host ${hubUrl.hostname} does not match LOTTO_REALTIME_EXPECTED_HUB_HOST ${expectedHost}.`,
    );
  }

  const publishToken = required(environment, "LOTTO_REALTIME_PUBLISH_TOKEN");
  if (
    publishToken.length < MIN_TOKEN_LENGTH ||
    publishToken.length > MAX_TOKEN_LENGTH
  ) {
    throw new Error(
      `LOTTO_REALTIME_PUBLISH_TOKEN must be ${MIN_TOKEN_LENGTH}-${MAX_TOKEN_LENGTH} characters.`,
    );
  }

  const timeoutMs = Number(
    environment.LOTTO_REALTIME_PUBLISH_TIMEOUT_MS ?? DEFAULT_TIMEOUT_MS,
  );
  if (
    !Number.isInteger(timeoutMs) ||
    timeoutMs < MIN_TIMEOUT_MS ||
    timeoutMs > MAX_TIMEOUT_MS
  ) {
    throw new Error(
      `LOTTO_REALTIME_PUBLISH_TIMEOUT_MS must be an integer from ${MIN_TIMEOUT_MS} to ${MAX_TIMEOUT_MS}.`,
    );
  }

  return {
    enabled: true,
    agencyId: agencyIdSchema.parse(
      required(environment, "LOTTO_REALTIME_AGENCY_ID"),
    ),
    hubOrigin: hubUrl.origin,
    publishToken,
    timeoutMs,
  };
};

export const publishPublicStateShadow = async (
  config: Extract<ShadowPublicationConfig, { enabled: true }>,
  intent: ShadowPublicationIntent,
  fetchImpl: typeof fetch = fetch,
): Promise<ShadowPublicationOutcome> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.timeoutMs);

  try {
    const publishedAt = new Date().toISOString();
    const envelope = publicStateEnvelopeSchema.parse({
      protocolVersion: 1,
      agencyId: config.agencyId,
      publicationId: intent.publicationId,
      revision: intent.revision,
      committedAt: intent.committedAt,
      publishedAt,
      checksum: intent.checksum,
      state: intent.state,
    });
    const response = await fetchImpl(
      new URL(
        `/v1/agencies/${config.agencyId}/publish`,
        config.hubOrigin,
      ),
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${config.publishToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify(envelope),
        cache: "no-store",
        signal: controller.signal,
      },
    );

    if (response.status === 200 || response.status === 202) {
      return { accepted: true, status: response.status };
    }
    return {
      accepted: false,
      error: `Realtime hub returned HTTP ${response.status}.`,
    };
  } catch {
    if (controller.signal.aborted) {
      return {
        accepted: false,
        error: `Realtime hub timed out after ${config.timeoutMs}ms.`,
      };
    }
    return {
      accepted: false,
      error: "Realtime publication failed.",
    };
  } finally {
    clearTimeout(timer);
  }
};

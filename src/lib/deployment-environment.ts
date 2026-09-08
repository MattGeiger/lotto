// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 Matt Geiger, Temple Consulting, LLC.

export const BETA_DEPLOYMENT_ENVIRONMENT = "beta";
export const PRODUCTION_DEPLOYMENT_ENVIRONMENT = "production";

type DeploymentEnvironment = Readonly<Record<string, string | undefined>>;

/**
 * The beta sandbox marker. This drives sandbox-only *presentation* — the
 * "Beta test environment" banner, the blocking `robots.txt`, and the
 * `X-Robots-Tag` header — and nothing else. Production must never report true
 * here, or the live site would de-index itself and tell every client their
 * actions do not affect the real app.
 */
export const isBetaDeployment = (
  environment: DeploymentEnvironment = process.env,
): boolean =>
  environment.LOTTO_DEPLOYMENT_ENVIRONMENT === BETA_DEPLOYMENT_ENVIRONMENT;

/**
 * Whether this deployment is allowed to activate realtime at all.
 *
 * Realtime used to be restricted to the beta sandbox, which conflated "this is
 * allowed to use the hub" with "this is a sandbox and should be hidden from
 * search engines". Production needs the first without the second, so the two
 * are now separate questions against the same variable.
 *
 * This stays fail-closed on purpose, which was the point of the original beta
 * restriction: only the two recognized values qualify. An unset, empty,
 * misspelled, or unknown `LOTTO_DEPLOYMENT_ENVIRONMENT` refuses realtime rather
 * than assuming it is welcome, so a deployment has to opt in deliberately —
 * being merely "not beta" is never enough.
 */
export const isRealtimeEligibleDeployment = (
  environment: DeploymentEnvironment = process.env,
): boolean => {
  const value = environment.LOTTO_DEPLOYMENT_ENVIRONMENT;
  return (
    value === BETA_DEPLOYMENT_ENVIRONMENT ||
    value === PRODUCTION_DEPLOYMENT_ENVIRONMENT
  );
};

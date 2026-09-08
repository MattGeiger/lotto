// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 Matt Geiger, Temple Consulting, LLC.

const LOCAL_HOSTS = new Set(["127.0.0.1", "localhost"]);
const DEFAULT_BETA_HOST = "lotto-realtime-beta.et2-geiger.workers.dev";

const boundedInteger = (rawValue, options) => {
  const value = rawValue === undefined ? options.defaultValue : Number(rawValue);
  if (!Number.isInteger(value) || value < options.min || value > options.max) {
    throw new Error(
      `${options.name} must be an integer from ${options.min} to ${options.max}.`,
    );
  }
  return value;
};

export const assertBetaOnlyTarget = (baseUrl, environment) => {
  if (LOCAL_HOSTS.has(baseUrl.hostname)) return;

  if (baseUrl.protocol !== "https:") {
    throw new Error("Remote benchmark targets must use HTTPS.");
  }
  if (environment.REALTIME_TEST_ALLOW_REMOTE !== "beta") {
    throw new Error(
      "Remote benchmarking requires REALTIME_TEST_ALLOW_REMOTE=beta.",
    );
  }

  const expectedHost =
    environment.REALTIME_TEST_EXPECTED_REMOTE_HOST ?? DEFAULT_BETA_HOST;
  if (baseUrl.hostname !== expectedHost) {
    throw new Error(
      `Remote benchmark target ${baseUrl.hostname} does not match the explicitly expected beta host ${expectedHost}.`,
    );
  }
};

/**
 * @param {Record<string, string | undefined>} [environment]
 */
export const resolveBenchmarkConfig = (environment = process.env) => {
  const baseUrl = new URL(
    environment.REALTIME_TEST_BASE_URL ?? "http://127.0.0.1:8787",
  );
  assertBetaOnlyTarget(baseUrl, environment);

  const clients = boundedInteger(environment.REALTIME_BENCHMARK_CLIENTS, {
    name: "REALTIME_BENCHMARK_CLIENTS",
    defaultValue: 10,
    min: 1,
    max: 100,
  });
  const publications = boundedInteger(
    environment.REALTIME_BENCHMARK_PUBLICATIONS,
    {
      name: "REALTIME_BENCHMARK_PUBLICATIONS",
      defaultValue: 5,
      min: 1,
      max: 20,
    },
  );
  const pollIntervalMs = boundedInteger(
    environment.REALTIME_BENCHMARK_POLL_INTERVAL_MS,
    {
      name: "REALTIME_BENCHMARK_POLL_INTERVAL_MS",
      defaultValue: 1_000,
      min: 250,
      max: 60_000,
    },
  );
  const observationTimeoutMs = boundedInteger(
    environment.REALTIME_BENCHMARK_TIMEOUT_MS,
    {
      name: "REALTIME_BENCHMARK_TIMEOUT_MS",
      defaultValue: Math.max(15_000, pollIntervalMs * 2),
      min: 1_000,
      max: 120_000,
    },
  );
  const idleBeforePublishMs = boundedInteger(
    environment.REALTIME_BENCHMARK_IDLE_MS,
    {
      name: "REALTIME_BENCHMARK_IDLE_MS",
      defaultValue: 0,
      min: 0,
      max: 300_000,
    },
  );
  const maxDurationMs = boundedInteger(
    environment.REALTIME_BENCHMARK_MAX_DURATION_MS,
    {
      name: "REALTIME_BENCHMARK_MAX_DURATION_MS",
      defaultValue: 120_000,
      min: 10_000,
      max: 600_000,
    },
  );
  const realtimeP95TargetMs = boundedInteger(
    environment.REALTIME_BENCHMARK_REALTIME_P95_TARGET_MS,
    {
      name: "REALTIME_BENCHMARK_REALTIME_P95_TARGET_MS",
      defaultValue: 2_000,
      min: 50,
      max: 30_000,
    },
  );

  if (publications * pollIntervalMs + idleBeforePublishMs > maxDurationMs) {
    throw new Error(
      "The configured publication cadence and idle window exceed REALTIME_BENCHMARK_MAX_DURATION_MS.",
    );
  }
  if (observationTimeoutMs > maxDurationMs) {
    throw new Error(
      "REALTIME_BENCHMARK_TIMEOUT_MS cannot exceed REALTIME_BENCHMARK_MAX_DURATION_MS.",
    );
  }

  return {
    baseUrl,
    clients,
    publications,
    pollIntervalMs,
    observationTimeoutMs,
    idleBeforePublishMs,
    maxDurationMs,
    realtimeP95TargetMs,
    allowedOrigin:
      environment.REALTIME_TEST_ORIGIN ?? "https://beta.williamtemple.app",
    outputDirectory:
      environment.REALTIME_BENCHMARK_OUTPUT_DIR ??
      "artifacts/realtime-benchmarks",
  };
};

export const percentile = (values, fraction) => {
  if (values.length === 0) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil(sorted.length * fraction) - 1),
  );
  return Number(sorted[index].toFixed(2));
};

export const summarizeLatencies = (values) => ({
  p50: percentile(values, 0.5),
  p95: percentile(values, 0.95),
  p99: percentile(values, 0.99),
  max: percentile(values, 1),
});

export const projectedPollingReadsPerHour = (clients, pollIntervalMs) =>
  Math.ceil((clients * 60 * 60 * 1_000) / pollIntervalMs);

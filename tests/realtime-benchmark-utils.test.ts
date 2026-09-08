// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 Matt Geiger, Temple Consulting, LLC.

import {
  assertBetaOnlyTarget,
  percentile,
  projectedPollingReadsPerHour,
  resolveBenchmarkConfig,
  summarizeLatencies,
} from "../scripts/lib/realtime-benchmark-utils.mjs";

describe("realtime benchmark safeguards", () => {
  it("allows local targets without the remote beta acknowledgement", () => {
    expect(() =>
      assertBetaOnlyTarget(new URL("http://127.0.0.1:8787"), {}),
    ).not.toThrow();
  });

  it("refuses a remote target without the beta acknowledgement", () => {
    expect(() =>
      assertBetaOnlyTarget(
        new URL("https://lotto-realtime-beta.et2-geiger.workers.dev"),
        {},
      ),
    ).toThrow(/REALTIME_TEST_ALLOW_REMOTE=beta/);
  });

  it("refuses an acknowledged remote host that is not the expected beta host", () => {
    expect(() =>
      assertBetaOnlyTarget(new URL("https://williamtemple.app"), {
        REALTIME_TEST_ALLOW_REMOTE: "beta",
      }),
    ).toThrow(/does not match the explicitly expected beta host/);
  });

  it("accepts an explicitly named alternate beta host", () => {
    expect(() =>
      assertBetaOnlyTarget(new URL("https://realtime-beta.example.org"), {
        REALTIME_TEST_ALLOW_REMOTE: "beta",
        REALTIME_TEST_EXPECTED_REMOTE_HOST: "realtime-beta.example.org",
      }),
    ).not.toThrow();
  });

  it("enforces bounded workloads", () => {
    expect(() =>
      resolveBenchmarkConfig({
        REALTIME_BENCHMARK_CLIENTS: "101",
      }),
    ).toThrow(/REALTIME_BENCHMARK_CLIENTS/);
    expect(() =>
      resolveBenchmarkConfig({
        REALTIME_BENCHMARK_PUBLICATIONS: "20",
        REALTIME_BENCHMARK_POLL_INTERVAL_MS: "60000",
        REALTIME_BENCHMARK_MAX_DURATION_MS: "600000",
      }),
    ).toThrow(/MAX_DURATION_MS/);
  });
});

describe("realtime benchmark reporting", () => {
  it("summarizes nearest-rank latency percentiles", () => {
    expect(percentile([5, 1, 4, 3, 2], 0.5)).toBe(3);
    expect(summarizeLatencies([5, 1, 4, 3, 2])).toEqual({
      p50: 3,
      p95: 5,
      p99: 5,
      max: 5,
    });
    expect(summarizeLatencies([])).toEqual({
      p50: null,
      p95: null,
      p99: null,
      max: null,
    });
  });

  it("projects polling reads at the configured synthetic cadence", () => {
    expect(projectedPollingReadsPerHour(10, 30_000)).toBe(1_200);
  });
});

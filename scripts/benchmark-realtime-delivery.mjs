// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 Matt Geiger, Temple Consulting, LLC.
//
// Synthetic A/B comparison for the isolated realtime proof. Both cohorts
// observe the same revisions in one dedicated Durable Object: one cohort polls
// snapshots while the other receives WebSocket broadcasts.

import assert from "node:assert/strict";
import crypto from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { performance } from "node:perf_hooks";

import {
  projectedPollingReadsPerHour,
  resolveBenchmarkConfig,
  summarizeLatencies,
} from "./lib/realtime-benchmark-utils.mjs";

const config = resolveBenchmarkConfig();
const publishToken = process.env.REALTIME_TEST_PUBLISH_TOKEN;
const agencyId = "william-temple-house-benchmark-e2e";
const idleAgencyId = "william-temple-house-idle-e2e";

if (!publishToken) {
  throw new Error("REALTIME_TEST_PUBLISH_TOKEN is required.");
}

const routeUrl = (action, targetAgencyId = agencyId) =>
  new URL(`/v1/agencies/${targetAgencyId}/${action}`, config.baseUrl);

const canonicalize = (value) => {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nestedValue]) => [key, canonicalize(nestedValue)]),
    );
  }
  return value;
};

const checksum = (value) =>
  `sha256:${crypto
    .createHash("sha256")
    .update(JSON.stringify(canonicalize(value)))
    .digest("hex")}`;

const stateFor = (revision) => ({
  startNumber: 1,
  endNumber: Math.max(3, config.publications + 1),
  mode: "sequential",
  generatedOrder: Array.from(
    { length: Math.max(3, config.publications + 1) },
    (_, index) => index + 1,
  ),
  currentlyServing: ((revision - 1) % Math.max(3, config.publications + 1)) + 1,
  ticketStatus: {},
  calledAt: {},
  orderLocked: true,
  timestamp: Date.now(),
  displayUrl: "https://beta.williamtemple.app",
  operatingHours: null,
  timezone: "America/Los_Angeles",
  displayLanguageRotation: null,
  announcement: null,
});

const envelopeFor = (revision, targetAgencyId = agencyId) => {
  const state = stateFor(revision);
  const now = new Date().toISOString();
  return {
    protocolVersion: 1,
    agencyId: targetAgencyId,
    publicationId: crypto.randomUUID(),
    revision,
    committedAt: now,
    publishedAt: now,
    checksum: checksum(state),
    state,
  };
};

const publish = async (envelope) => {
  const startedAt = performance.now();
  const response = await fetch(routeUrl("publish", envelope.agencyId), {
    method: "POST",
    headers: {
      authorization: `Bearer ${publishToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(envelope),
  });
  const acceptedMs = performance.now() - startedAt;
  assert.equal(response.status, 202, `publication ${envelope.revision}`);
  return Number(acceptedMs.toFixed(2));
};

const waitUntil = async (predicate, timeoutMs, description) => {
  const startedAt = performance.now();
  while (!predicate()) {
    if (performance.now() - startedAt > timeoutMs) {
      throw new Error(`Timed out waiting for ${description}.`);
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
};

const createPollingCohort = (onEnvelope) => {
  let stopped = false;
  let requestCount = 0;
  const readyClients = new Set();
  const errors = [];
  const sleepers = new Set();

  const interruptibleDelay = (delayMs) =>
    new Promise((resolve) => {
      if (stopped) {
        resolve();
        return;
      }
      const sleeper = { timer: null, resolve };
      sleeper.timer = setTimeout(() => {
        sleepers.delete(sleeper);
        resolve();
      }, delayMs);
      sleepers.add(sleeper);
    });

  const tasks = Array.from({ length: config.clients }, (_, clientIndex) =>
    (async () => {
      const staggerMs = Math.floor(
        (clientIndex * config.pollIntervalMs) / config.clients,
      );
      await interruptibleDelay(staggerMs);
      while (!stopped) {
        const requestStartedAt = performance.now();
        requestCount += 1;
        try {
          const response = await fetch(routeUrl("state"), {
            headers: { origin: config.allowedOrigin },
          });
          if (!response.ok) {
            throw new Error(`snapshot returned ${response.status}`);
          }
          const envelope = await response.json();
          readyClients.add(clientIndex);
          onEnvelope("polling", clientIndex, envelope);
        } catch (error) {
          errors.push(
            error instanceof Error ? error.message : "Unknown polling error",
          );
        }
        const elapsedMs = performance.now() - requestStartedAt;
        await interruptibleDelay(
          Math.max(0, config.pollIntervalMs - elapsedMs),
        );
      }
    })(),
  );

  return {
    get requestCount() {
      return requestCount;
    },
    readyClients,
    errors,
    async stop() {
      stopped = true;
      for (const sleeper of sleepers) {
        clearTimeout(sleeper.timer);
        sleeper.resolve();
      }
      sleepers.clear();
      await Promise.allSettled(tasks);
    },
  };
};

const connectRealtimeCohort = async (onEnvelope, targetAgencyId = agencyId) => {
  const eventsUrl = routeUrl("events", targetAgencyId);
  eventsUrl.protocol = eventsUrl.protocol === "https:" ? "wss:" : "ws:";
  const sockets = [];
  const connectLatencies = [];
  const errors = [];

  await Promise.all(
    Array.from({ length: config.clients }, (_, clientIndex) =>
      new Promise((resolve, reject) => {
        const startedAt = performance.now();
        const socket = new WebSocket(eventsUrl);
        sockets.push(socket);
        const timer = setTimeout(() => {
          socket.close(1011, "Connection timeout");
          reject(new Error(`WebSocket client ${clientIndex} timed out.`));
        }, config.observationTimeoutMs);

        socket.addEventListener("message", (event) => {
          try {
            onEnvelope("realtime", clientIndex, JSON.parse(String(event.data)));
          } catch (error) {
            errors.push(
              error instanceof Error
                ? error.message
                : "Unknown WebSocket message error",
            );
          }
        });
        socket.addEventListener(
          "open",
          () => {
            clearTimeout(timer);
            connectLatencies.push(performance.now() - startedAt);
            resolve();
          },
          { once: true },
        );
        socket.addEventListener(
          "error",
          () => {
            clearTimeout(timer);
            reject(new Error(`WebSocket client ${clientIndex} failed.`));
          },
          { once: true },
        );
      }),
    ),
  );

  return {
    sockets,
    connectLatencies,
    errors,
    close() {
      for (const socket of sockets) socket.close(1000, "Benchmark complete");
    },
  };
};

const runRealtimeIdleProbe = async (deadlineAt) => {
  if (config.idleBeforePublishMs === 0) {
    return { enabled: false };
  }
  if (performance.now() + config.idleBeforePublishMs >= deadlineAt) {
    throw new Error("The realtime-only idle probe would exceed the run deadline.");
  }

  const existingResponse = await fetch(routeUrl("state", idleAgencyId));
  const existing = existingResponse.ok ? await existingResponse.json() : null;
  const seedRevision =
    typeof existing?.revision === "number" ? existing.revision + 1 : 1;
  await publish(envelopeFor(seedRevision, idleAgencyId));

  const targetRevision = seedRevision + 1;
  const targetEnvelope = envelopeFor(targetRevision, idleAgencyId);
  const observations = new Map();
  const mismatches = [];
  let publicationStartedAt = 0;
  const realtime = await connectRealtimeCohort(
    (_cohort, clientIndex, envelope) => {
      if (envelope.revision !== targetRevision) return;
      if (envelope.checksum !== targetEnvelope.checksum) {
        mismatches.push({
          clientIndex,
          expectedChecksum: targetEnvelope.checksum,
          observedChecksum: envelope.checksum,
        });
        return;
      }
      if (!observations.has(clientIndex)) {
        observations.set(clientIndex, performance.now() - publicationStartedAt);
      }
    },
    idleAgencyId,
  );

  try {
    await new Promise((resolve) =>
      setTimeout(resolve, config.idleBeforePublishMs),
    );
    publicationStartedAt = performance.now();
    const publishAcceptedMs = await publish(targetEnvelope);
    await waitUntil(
      () => observations.size === config.clients,
      Math.min(config.observationTimeoutMs, deadlineAt - performance.now()),
      `realtime-only idle delivery of revision ${targetRevision}`,
    );

    return {
      enabled: true,
      agencyId: idleAgencyId,
      idleMs: config.idleBeforePublishMs,
      clients: config.clients,
      observed: observations.size,
      publishAcceptedMs,
      deliveryMs: summarizeLatencies([...observations.values()]),
      connectMs: summarizeLatencies(realtime.connectLatencies),
      checksumMismatches: mismatches,
      messageErrors: realtime.errors,
      recurringSnapshotRequestsDuringIdle: 0,
    };
  } finally {
    realtime.close();
  }
};

const existingResponse = await fetch(routeUrl("state"));
const existing = existingResponse.ok ? await existingResponse.json() : null;
let revision = typeof existing?.revision === "number" ? existing.revision + 1 : 1;

await publish(envelopeFor(revision));
revision += 1;

const benchmarkStartedAt = performance.now();
const deadlineAt = benchmarkStartedAt + config.maxDurationMs;
const publications = new Map();
const observations = {
  polling: new Map(),
  realtime: new Map(),
};
const mismatches = [];

const observe = (cohort, clientIndex, envelope) => {
  const publication = publications.get(envelope.revision);
  if (!publication) return;
  const perRevision = observations[cohort].get(envelope.revision) ?? new Map();
  if (perRevision.has(clientIndex)) return;
  if (envelope.checksum !== publication.checksum) {
    mismatches.push({
      cohort,
      clientIndex,
      revision: envelope.revision,
      expectedChecksum: publication.checksum,
      observedChecksum: envelope.checksum,
    });
    return;
  }
  perRevision.set(clientIndex, performance.now() - publication.startedAt);
  observations[cohort].set(envelope.revision, perRevision);
};

const realtime = await connectRealtimeCohort(observe);
const polling = createPollingCohort(observe);

try {
  await waitUntil(
    () => polling.readyClients.size === config.clients,
    config.observationTimeoutMs,
    "all polling clients to read the seed revision",
  );
  const pollingRequestsBeforeMeasurement = polling.requestCount;

  const eventResults = [];
  for (let index = 0; index < config.publications; index += 1) {
    if (performance.now() >= deadlineAt) {
      throw new Error("The benchmark exceeded its configured maximum duration.");
    }

    const envelope = envelopeFor(revision);
    publications.set(revision, {
      checksum: envelope.checksum,
      startedAt: performance.now(),
    });
    const publishAcceptedMs = await publish(envelope);

    await Promise.all([
      waitUntil(
        () => observations.polling.get(revision)?.size === config.clients,
        Math.min(config.observationTimeoutMs, deadlineAt - performance.now()),
        `polling delivery of revision ${revision}`,
      ),
      waitUntil(
        () => observations.realtime.get(revision)?.size === config.clients,
        Math.min(config.observationTimeoutMs, deadlineAt - performance.now()),
        `realtime delivery of revision ${revision}`,
      ),
    ]);

    eventResults.push({
      revision,
      publishAcceptedMs,
      pollingMs: summarizeLatencies([
        ...observations.polling.get(revision).values(),
      ]),
      realtimeMs: summarizeLatencies([
        ...observations.realtime.get(revision).values(),
      ]),
    });
    revision += 1;
  }

  const pollingRequestsAfterComparison = polling.requestCount;
  await polling.stop();
  const idleWake = await runRealtimeIdleProbe(deadlineAt);

  const pollingLatencies = [
    ...observations.polling.values(),
  ].flatMap((clients) => [...clients.values()]);
  const realtimeLatencies = [
    ...observations.realtime.values(),
  ].flatMap((clients) => [...clients.values()]);
  const pollingRequestsDuringMeasurement =
    pollingRequestsAfterComparison - pollingRequestsBeforeMeasurement;
  const expectedDeliveries = config.clients * config.publications;
  const realtimeSummary = summarizeLatencies(realtimeLatencies);
  const gates = {
    pollingDeliveryComplete: pollingLatencies.length === expectedDeliveries,
    realtimeDeliveryComplete: realtimeLatencies.length === expectedDeliveries,
    checksumsAgree: mismatches.length === 0,
    realtimeP95WithinTarget:
      realtimeSummary.p95 !== null &&
      realtimeSummary.p95 <= config.realtimeP95TargetMs,
    realtimeRecurringSnapshotReadsAreZero: true,
    realtimeIdleWakeComplete:
      !idleWake.enabled || idleWake.observed === config.clients,
    realtimeIdleWakeP95WithinTarget:
      !idleWake.enabled ||
      (idleWake.deliveryMs.p95 !== null &&
        idleWake.deliveryMs.p95 <= config.realtimeP95TargetMs),
    realtimeIdleWakeChecksumsAgree:
      !idleWake.enabled || idleWake.checksumMismatches.length === 0,
  };
  const passed = Object.values(gates).every(Boolean);

  const report = {
    passed,
    recordedAt: new Date().toISOString(),
    agencyId,
    target: config.baseUrl.origin,
    configuration: {
      clientsPerCohort: config.clients,
      publications: config.publications,
      pollIntervalMs: config.pollIntervalMs,
      realtimeOnlyIdleProbeMs: config.idleBeforePublishMs,
      realtimeP95TargetMs: config.realtimeP95TargetMs,
    },
    delivery: {
      expectedPerCohort: expectedDeliveries,
      pollingObserved: pollingLatencies.length,
      realtimeObserved: realtimeLatencies.length,
      pollingMs: summarizeLatencies(pollingLatencies),
      realtimeMs: realtimeSummary,
      realtimeConnectMs: summarizeLatencies(realtime.connectLatencies),
      realtimeIdleWake: idleWake,
      events: eventResults,
    },
    resourceSignals: {
      pollingSnapshotRequestsDuringMeasurement:
        pollingRequestsDuringMeasurement,
      realtimeRecurringSnapshotRequestsDuringMeasurement: 0,
      realtimeInitialWebSocketConnections: config.clients,
      realtimeIdleProbeRecurringSnapshotRequests: idleWake.enabled
        ? idleWake.recurringSnapshotRequestsDuringIdle
        : null,
      syntheticPollingReadsPerHourAtConfiguredCadence:
        projectedPollingReadsPerHour(config.clients, config.pollIntervalMs),
    },
    errors: {
      polling: polling.errors,
      realtime: realtime.errors,
      checksumMismatches: mismatches,
    },
    gates,
    limitations: [
      "This Phase 2 benchmark uses synthetic state in the isolated Durable Object; it does not query Neon or the Vercel application.",
      "Zero recurring snapshot reads here proves transport behavior, not Neon compute savings. Phase 3 shadow publication and Phase 4 client integration are required for that claim.",
      "A realtime-only idle probe can prove delivery after a request-free idle window, but actual Durable Object hibernation must still be confirmed with Cloudflare platform metrics.",
    ],
  };
  const serializedReport = JSON.stringify(report, null, 2);
  const outputDirectory = path.resolve(config.outputDirectory);
  const outputPath = path.join(
    outputDirectory,
    `${report.recordedAt.replaceAll(":", "-")}.json`,
  );
  await mkdir(outputDirectory, { recursive: true });
  await writeFile(outputPath, `${serializedReport}\n`, "utf8");

  console.log(serializedReport);
  console.error(`Benchmark report written to ${outputPath}`);

  if (!passed) process.exitCode = 1;
} finally {
  realtime.close();
  await polling.stop();
}

// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 Matt Geiger, Temple Consulting, LLC.
//
// Bounded fanout test for the isolated realtime proof. It writes only to the
// dedicated `william-temple-house-load-e2e` Durable Object.

import assert from "node:assert/strict";
import crypto from "node:crypto";
import { performance } from "node:perf_hooks";

const baseUrl = new URL(
  process.env.REALTIME_TEST_BASE_URL ?? "http://127.0.0.1:8787",
);
const publishToken = process.env.REALTIME_TEST_PUBLISH_TOKEN;
const agencyId = "william-temple-house-load-e2e";
const timeoutMs = Number(process.env.REALTIME_LOAD_TIMEOUT_MS ?? 15_000);
const clientCounts = (process.env.REALTIME_LOAD_CLIENTS ?? "1,10,100,200")
  .split(",")
  .map((value) => Number(value.trim()));

if (!publishToken) {
  throw new Error("REALTIME_TEST_PUBLISH_TOKEN is required.");
}
if (
  baseUrl.hostname !== "127.0.0.1" &&
  baseUrl.hostname !== "localhost" &&
  process.env.REALTIME_TEST_ALLOW_REMOTE !== "beta"
) {
  throw new Error(
    "Remote load verification requires REALTIME_TEST_ALLOW_REMOTE=beta to protect non-beta Workers.",
  );
}
if (
  clientCounts.length === 0 ||
  clientCounts.some(
    (count) => !Number.isInteger(count) || count < 1 || count > 500,
  ) ||
  clientCounts.reduce((total, count) => total + count, 0) > 1_000
) {
  throw new Error(
    "REALTIME_LOAD_CLIENTS must contain integers from 1 to 500 with at most 1,000 total clients.",
  );
}
if (!Number.isFinite(timeoutMs) || timeoutMs < 1_000 || timeoutMs > 60_000) {
  throw new Error("REALTIME_LOAD_TIMEOUT_MS must be between 1000 and 60000.");
}

const routeUrl = (action) =>
  new URL(`/v1/agencies/${agencyId}/${action}`, baseUrl);

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

const percentile = (values, fraction) => {
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil(sorted.length * fraction) - 1),
  );
  return Number(sorted[index].toFixed(2));
};

const summarize = (values) => ({
  p50: percentile(values, 0.5),
  p95: percentile(values, 0.95),
  max: percentile(values, 1),
});

const stateFor = (revision) => ({
  startNumber: 1,
  endNumber: 3,
  mode: "sequential",
  generatedOrder: [1, 2, 3],
  currentlyServing: ((revision - 1) % 3) + 1,
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

const envelopeFor = (revision) => {
  const state = stateFor(revision);
  const now = new Date().toISOString();
  return {
    protocolVersion: 1,
    agencyId,
    publicationId: crypto.randomUUID(),
    revision,
    committedAt: now,
    publishedAt: now,
    checksum: checksum(state),
    state,
  };
};

const connectClients = async (count) => {
  const eventsUrl = routeUrl("events");
  eventsUrl.protocol = eventsUrl.protocol === "https:" ? "wss:" : "ws:";
  const sockets = [];
  const connectLatencies = [];

  await Promise.all(
    Array.from({ length: count }, () =>
      new Promise((resolve, reject) => {
        const startedAt = performance.now();
        const socket = new WebSocket(eventsUrl);
        sockets.push(socket);
        const timer = setTimeout(() => {
          socket.close(1011, "Connection timeout");
          reject(new Error(`WebSocket connection timeout at ${count} clients`));
        }, timeoutMs);
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
            reject(new Error(`WebSocket connection failed at ${count} clients`));
          },
          { once: true },
        );
      }),
    ),
  );

  return { sockets, connectLatencies };
};

const publishToClients = async (sockets, revision) => {
  let publishedAt = 0;
  const deliveryLatencies = [];
  const deliveries = sockets.map(
    (socket) =>
      new Promise((resolve, reject) => {
        const timer = setTimeout(
          () => reject(new Error(`Broadcast timeout at revision ${revision}`)),
          timeoutMs,
        );
        const onMessage = (event) => {
          let message;
          try {
            message = JSON.parse(String(event.data));
          } catch {
            return;
          }
          if (message.revision !== revision) return;
          clearTimeout(timer);
          socket.removeEventListener("message", onMessage);
          deliveryLatencies.push(performance.now() - publishedAt);
          resolve();
        };
        socket.addEventListener("message", onMessage);
      }),
  );

  const envelope = envelopeFor(revision);
  const publishStartedAt = performance.now();
  publishedAt = publishStartedAt;
  const response = await fetch(routeUrl("publish"), {
    method: "POST",
    headers: {
      authorization: `Bearer ${publishToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(envelope),
  });
  const publishAcceptedMs = performance.now() - publishStartedAt;
  assert.equal(response.status, 202, `publication for revision ${revision}`);
  await Promise.all(deliveries);

  return { deliveryLatencies, publishAcceptedMs };
};

const existingResponse = await fetch(routeUrl("state"));
const existing = existingResponse.ok ? await existingResponse.json() : null;
let revision = typeof existing?.revision === "number" ? existing.revision + 1 : 1;
const results = [];

for (const clientCount of clientCounts) {
  const { sockets, connectLatencies } = await connectClients(clientCount);
  try {
    const { deliveryLatencies, publishAcceptedMs } = await publishToClients(
      sockets,
      revision,
    );
    results.push({
      clients: clientCount,
      revision,
      connected: sockets.length,
      delivered: deliveryLatencies.length,
      connectMs: summarize(connectLatencies),
      deliveryMs: summarize(deliveryLatencies),
      publishAcceptedMs: Number(publishAcceptedMs.toFixed(2)),
    });
  } finally {
    for (const socket of sockets) socket.close(1000, "Load test complete");
  }
  revision += 1;
}

console.log(
  JSON.stringify({
    agencyId,
    totalConnections: clientCounts.reduce((total, count) => total + count, 0),
    results,
  }),
);

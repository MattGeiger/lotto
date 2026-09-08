// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Matt Geiger, Temple Consulting, LLC.

const baseUrl = new URL(
  process.env.REALTIME_CONTROL_BASE_URL ?? "http://127.0.0.1:8787",
);
const controlToken = process.env.REALTIME_CONTROL_TOKEN;
const agencyId = process.env.REALTIME_CONTROL_AGENCY_ID;
const mode = process.env.REALTIME_CONTROL_MODE ?? "status";

if (!controlToken || controlToken.length < 32) {
  throw new Error("REALTIME_CONTROL_TOKEN must contain at least 32 characters.");
}
if (!agencyId || agencyId.length > 64 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(agencyId)) {
  throw new Error("REALTIME_CONTROL_AGENCY_ID must be a lowercase kebab-case agency id.");
}
if (!["status", "drain", "resume"].includes(mode)) {
  throw new Error("REALTIME_CONTROL_MODE must be status, drain, or resume.");
}
if (
  baseUrl.username
  || baseUrl.password
  || baseUrl.search
  || baseUrl.hash
  || (baseUrl.pathname !== "/" && baseUrl.pathname !== "")
) {
  throw new Error("REALTIME_CONTROL_BASE_URL must be an origin without credentials, path, query, or fragment.");
}

const isLocal = baseUrl.hostname === "127.0.0.1" || baseUrl.hostname === "localhost";
if (!isLocal) {
  if (baseUrl.protocol !== "https:") {
    throw new Error("Remote realtime control requires an HTTPS origin.");
  }
  const expectedConfirmation = `${mode}:${agencyId}@${baseUrl.hostname}`;
  if (process.env.REALTIME_CONTROL_CONFIRM !== expectedConfirmation) {
    throw new Error(
      `Remote control requires REALTIME_CONTROL_CONFIRM=${expectedConfirmation}`,
    );
  }
}

const controlUrl = new URL(
  `/v1/agencies/${encodeURIComponent(agencyId)}/control`,
  baseUrl,
);
const response = await fetch(controlUrl, {
  method: mode === "status" ? "GET" : "POST",
  headers: {
    authorization: `Bearer ${controlToken}`,
    ...(mode === "status" ? {} : { "content-type": "application/json" }),
  },
  body: mode === "status" ? undefined : JSON.stringify({ mode }),
});

const responseText = await response.text();
let result;
try {
  result = JSON.parse(responseText);
} catch {
  result = { error: "Realtime control returned a non-JSON response." };
}

if (!response.ok) {
  throw new Error(
    `Realtime control failed with HTTP ${response.status}: ${result.error ?? "Unknown error"}`,
  );
}

console.log(JSON.stringify({
  agencyId,
  host: baseUrl.hostname,
  mode,
  ...result,
}));

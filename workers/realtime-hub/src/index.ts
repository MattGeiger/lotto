// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 Matt Geiger, Temple Consulting, LLC.
//
// LOTTO — Line Order Transparency & Ticketing Organizer. Application code
// licensed under AGPL-3.0-or-later; see LICENSE. William Temple House branding
// is not covered by this license; see TRADEMARKS.md.

import { DurableObject } from "cloudflare:workers";

import {
  agencyIdSchema,
  hashPublicState,
  publicStateEnvelopeSchema,
  type PublicStateEnvelope,
} from "../../../src/lib/realtime/public-state-protocol";

type Env = {
  PUBLIC_STATE_HUB: DurableObjectNamespace<PublicStateHub>;
  PUBLISH_TOKEN?: string;
  CONTROL_TOKEN?: string;
  ALLOWED_ORIGINS?: string;
  ENVIRONMENT?: string;
};

const MAX_PUBLISH_BYTES = 1_000_000;
const MAX_CONTROL_BYTES = 1_024;
const STATE_STORAGE_KEY = "latest-public-state";
const CONNECTIONS_DRAINED_STORAGE_KEY = "connections-drained";
const SUBSCRIBER_TAG = "public-state-subscriber";
const OPERATOR_DRAIN_CLOSE_CODE = 4_001;

const jsonResponse = (body: unknown, status = 200, headers?: HeadersInit) =>
  Response.json(body, {
    status,
    headers: {
      "cache-control": "no-store",
      ...headers,
    },
  });

const parseAllowedOrigins = (value?: string) =>
  new Set(
    (value ?? "")
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean),
  );

const corsHeaders = (origin: string | null, allowedOrigins: Set<string>) => {
  const headers = new Headers({ vary: "Origin" });
  if (origin && allowedOrigins.has(origin)) {
    headers.set("access-control-allow-origin", origin);
    headers.set("access-control-allow-methods", "GET, OPTIONS");
    headers.set("access-control-allow-headers", "Content-Type");
    headers.set("access-control-max-age", "86400");
  }
  return headers;
};

const withCors = (
  response: Response,
  origin: string | null,
  allowedOrigins: Set<string>,
) => {
  const headers = new Headers(response.headers);
  corsHeaders(origin, allowedOrigins).forEach((value, key) =>
    headers.set(key, value),
  );
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
};

const isOriginAllowed = (origin: string | null, allowedOrigins: Set<string>) =>
  origin === null || allowedOrigins.has(origin);

const secureCompare = async (left: string, right: string) => {
  const encoder = new TextEncoder();
  const [leftDigest, rightDigest] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(left)),
    crypto.subtle.digest("SHA-256", encoder.encode(right)),
  ]);
  const leftBytes = new Uint8Array(leftDigest);
  const rightBytes = new Uint8Array(rightDigest);
  let difference = 0;
  for (let index = 0; index < leftBytes.length; index += 1) {
    difference |= leftBytes[index] ^ rightBytes[index];
  }
  return difference === 0;
};

const parseRoute = (pathname: string) => {
  const match = pathname.match(
    /^\/v1\/agencies\/([^/]+)\/(state|events|publish|control)\/?$/,
  );
  if (!match) return null;
  const agencyResult = agencyIdSchema.safeParse(decodeURIComponent(match[1]));
  if (!agencyResult.success) return null;
  return {
    agencyId: agencyResult.data,
    action: match[2] as "state" | "events" | "publish" | "control",
  };
};

export class PublicStateHub extends DurableObject<Env> {
  async fetch(request: Request): Promise<Response> {
    const action = new URL(request.url).pathname.slice(1);
    if (action === "state" && request.method === "GET") {
      const latest =
        await this.ctx.storage.get<PublicStateEnvelope>(STATE_STORAGE_KEY);
      return latest
        ? jsonResponse(latest)
        : jsonResponse({ error: "No public state has been published." }, 404);
    }

    if (action === "events" && request.method === "GET") {
      const connectionsDrained =
        (await this.ctx.storage.get<boolean>(CONNECTIONS_DRAINED_STORAGE_KEY)) === true;
      if (connectionsDrained) {
        return jsonResponse(
          { error: "Realtime connections are temporarily disabled." },
          503,
          { "retry-after": "300" },
        );
      }
      if (request.headers.get("upgrade")?.toLowerCase() !== "websocket") {
        return jsonResponse(
          { error: "A WebSocket upgrade is required." },
          426,
          {
            upgrade: "websocket",
          },
        );
      }

      const pair = new WebSocketPair();
      const client = pair[0];
      const server = pair[1];
      this.ctx.acceptWebSocket(server, [SUBSCRIBER_TAG]);

      const latest =
        await this.ctx.storage.get<PublicStateEnvelope>(STATE_STORAGE_KEY);
      if (latest) {
        server.send(JSON.stringify(latest));
      }

      return new Response(null, { status: 101, webSocket: client });
    }

    if (action === "publish" && request.method === "POST") {
      const parsed = publicStateEnvelopeSchema.safeParse(await request.json());
      if (!parsed.success) {
        return jsonResponse({ error: "Invalid public-state envelope." }, 400);
      }

      const envelope = parsed.data;
      const outcome = await this.ctx.storage.transaction(
        async (transaction) => {
          const latest =
            await transaction.get<PublicStateEnvelope>(STATE_STORAGE_KEY);
          const connectionsDrained =
            (await transaction.get<boolean>(CONNECTIONS_DRAINED_STORAGE_KEY)) === true;
          if (latest && envelope.revision < latest.revision) {
            return {
              status: "stale" as const,
              latestRevision: latest.revision,
              connectionsDrained,
            };
          }
          if (latest && envelope.revision === latest.revision) {
            if (envelope.checksum === latest.checksum) {
              return {
                status: "duplicate" as const,
                latestRevision: latest.revision,
                connectionsDrained,
              };
            }
            return {
              status: "conflict" as const,
              latestRevision: latest.revision,
              connectionsDrained,
            };
          }
          await transaction.put(STATE_STORAGE_KEY, envelope);
          return {
            status: "stored" as const,
            latestRevision: envelope.revision,
            connectionsDrained,
          };
        },
      );

      if (outcome.status === "stale" || outcome.status === "conflict") {
        return jsonResponse(
          {
            error:
              outcome.status === "stale"
                ? "The publication revision is stale."
                : "The revision already exists with a different checksum.",
            latestRevision: outcome.latestRevision,
          },
          409,
        );
      }

      if (outcome.status === "stored" && !outcome.connectionsDrained) {
        const message = JSON.stringify(envelope);
        for (const socket of this.ctx.getWebSockets(SUBSCRIBER_TAG)) {
          try {
            socket.send(message);
          } catch {
            socket.close(1011, "Unable to deliver public state.");
          }
        }
      }

      return jsonResponse(
        {
          accepted: true,
          duplicate: outcome.status === "duplicate",
          revision: outcome.latestRevision,
          connectionsDrained: outcome.connectionsDrained,
        },
        outcome.status === "stored" ? 202 : 200,
      );
    }

    if (action === "control" && request.method === "GET") {
      const connectionsDrained =
        (await this.ctx.storage.get<boolean>(CONNECTIONS_DRAINED_STORAGE_KEY)) === true;
      return jsonResponse({
        connectionsDrained,
        connectedClients: this.ctx.getWebSockets(SUBSCRIBER_TAG).length,
      });
    }

    if (action === "control" && request.method === "POST") {
      const body = await request.json<unknown>();
      const mode =
        body && typeof body === "object" && "mode" in body
          ? (body as { mode?: unknown }).mode
          : null;
      if (mode !== "drain" && mode !== "resume") {
        return jsonResponse({ error: "Control mode must be drain or resume." }, 400);
      }

      if (mode === "resume") {
        await this.ctx.storage.delete(CONNECTIONS_DRAINED_STORAGE_KEY);
        return jsonResponse({
          connectionsDrained: false,
          closedClients: 0,
        });
      }

      await this.ctx.storage.put(CONNECTIONS_DRAINED_STORAGE_KEY, true);
      const sockets = this.ctx.getWebSockets(SUBSCRIBER_TAG);
      for (const socket of sockets) {
        try {
          socket.close(
            OPERATOR_DRAIN_CLOSE_CODE,
            "Realtime source disabled by operator.",
          );
        } catch {
          // A concurrently disconnected socket is already drained.
        }
      }
      return jsonResponse({
        connectionsDrained: true,
        closedClients: sockets.length,
      });
    }

    return jsonResponse({ error: "Not found." }, 404);
  }

  webSocketMessage(socket: WebSocket) {
    socket.close(1008, "This endpoint is subscribe-only.");
  }

  webSocketClose(socket: WebSocket, code: number, reason: string) {
    socket.close(code, reason);
  }
}

const worker: ExportedHandler<Env> = {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/health" && request.method === "GET") {
      return jsonResponse({
        ok: true,
        environment: env.ENVIRONMENT ?? "unknown",
        protocolVersion: 1,
      });
    }

    const route = parseRoute(url.pathname);
    if (!route) {
      return jsonResponse({ error: "Not found." }, 404);
    }

    const allowedOrigins = parseAllowedOrigins(env.ALLOWED_ORIGINS);
    const origin = request.headers.get("origin");
    if (!isOriginAllowed(origin, allowedOrigins)) {
      return jsonResponse({ error: "Origin not allowed." }, 403);
    }

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(origin, allowedOrigins),
      });
    }

    const id = env.PUBLIC_STATE_HUB.idFromName(route.agencyId);
    const stub = env.PUBLIC_STATE_HUB.get(id);

    if (route.action === "events") {
      if (request.method !== "GET") {
        return jsonResponse({ error: "Method not allowed." }, 405);
      }
      const internalUrl = new URL("/events", request.url);
      return stub.fetch(new Request(internalUrl, request));
    }

    if (route.action === "state") {
      if (request.method !== "GET") {
        return jsonResponse({ error: "Method not allowed." }, 405);
      }
      const internalUrl = new URL("/state", request.url);
      const response = await stub.fetch(new Request(internalUrl, request));
      return withCors(response, origin, allowedOrigins);
    }

    const isControl = route.action === "control";
    const methodAllowed = isControl
      ? request.method === "GET" || request.method === "POST"
      : request.method === "POST";
    if (!methodAllowed) return jsonResponse({ error: "Method not allowed." }, 405);

    const requiredToken = isControl ? env.CONTROL_TOKEN : env.PUBLISH_TOKEN;
    if (!requiredToken) {
      return jsonResponse(
        { error: isControl ? "Control is not configured." : "Publishing is not configured." },
        503,
      );
    }

    const authorization = request.headers.get("authorization") ?? "";
    const submittedToken = authorization.startsWith("Bearer ")
      ? authorization.slice("Bearer ".length)
      : "";
    if (
      !submittedToken ||
      !(await secureCompare(submittedToken, requiredToken))
    ) {
      return jsonResponse({ error: "Unauthorized." }, 401, {
        "www-authenticate": "Bearer",
      });
    }
    if (
      isControl
      && env.PUBLISH_TOKEN
      && (await secureCompare(requiredToken, env.PUBLISH_TOKEN))
    ) {
      return jsonResponse({ error: "Control credential is misconfigured." }, 503);
    }

    if (isControl && request.method === "GET") {
      const internalUrl = new URL("/control", request.url);
      return stub.fetch(new Request(internalUrl, { method: "GET" }));
    }

    const maxBodyBytes = isControl ? MAX_CONTROL_BYTES : MAX_PUBLISH_BYTES;
    const contentLength = Number(request.headers.get("content-length") ?? 0);
    if (Number.isFinite(contentLength) && contentLength > maxBodyBytes) {
      return jsonResponse({ error: "Request body is too large." }, 413);
    }

    const rawBody = await request.text();
    if (new TextEncoder().encode(rawBody).byteLength > maxBodyBytes) {
      return jsonResponse({ error: "Request body is too large." }, 413);
    }

    let json: unknown;
    try {
      json = JSON.parse(rawBody);
    } catch {
      return jsonResponse({ error: "Invalid JSON." }, 400);
    }

    if (isControl) {
      const internalUrl = new URL("/control", request.url);
      return stub.fetch(
        new Request(internalUrl, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(json),
        }),
      );
    }

    const parsed = publicStateEnvelopeSchema.safeParse(json);
    if (!parsed.success || parsed.data.agencyId !== route.agencyId) {
      return jsonResponse({ error: "Invalid public-state envelope." }, 400);
    }
    if ((await hashPublicState(parsed.data.state)) !== parsed.data.checksum) {
      return jsonResponse({ error: "Public-state checksum mismatch." }, 400);
    }

    const internalUrl = new URL("/publish", request.url);
    return stub.fetch(
      new Request(internalUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(parsed.data),
      }),
    );
  },
};

export default worker;

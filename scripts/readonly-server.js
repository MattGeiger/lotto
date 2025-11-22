#!/usr/bin/env node

const http = require("node:http");
const fs = require("node:fs/promises");
const path = require("node:path");

const port = Number.parseInt(process.env.READONLY_PORT ?? "4000", 10) || 4000;
const pollIntervalMs =
  Number.parseInt(process.env.READONLY_POLL_MS ?? "4000", 10) || 4000;
const dataDir = process.env.READONLY_DATA_DIR
  ? path.resolve(process.env.READONLY_DATA_DIR)
  : path.join(process.cwd(), "data");
const statePath = path.join(dataDir, "state.json");

const defaultState = {
  startNumber: 0,
  endNumber: 0,
  mode: "random",
  generatedOrder: [],
  currentlyServing: null,
  timestamp: null,
};

const loadState = async () => {
  try {
    const contents = await fs.readFile(statePath, "utf-8");
    const parsed = JSON.parse(contents);
    return { ...defaultState, ...parsed };
  } catch {
    return defaultState;
  }
};

const htmlPage = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Raffle Read-only Board</title>
    <style>
      :root {
        color-scheme: light;
        font-family: "Inter", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        background: #0f172a;
        color: #e2e8f0;
      }
      body {
        margin: 0;
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 32px;
      }
      .shell {
        width: min(1100px, 100%);
        background: linear-gradient(135deg, rgba(15, 23, 42, 0.8), rgba(30, 41, 59, 0.7));
        border: 1px solid rgba(148, 163, 184, 0.15);
        border-radius: 24px;
        padding: 28px;
        box-shadow: 0 24px 80px rgba(0, 0, 0, 0.45);
        backdrop-filter: blur(8px);
      }
      header {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 16px;
      }
      .title {
        font-size: 24px;
        font-weight: 700;
        letter-spacing: -0.01em;
        color: #f8fafc;
      }
      .meta {
        display: flex;
        gap: 10px;
        flex-wrap: wrap;
        align-items: center;
        font-size: 13px;
        color: #cbd5e1;
      }
      .pill {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 6px 12px;
        border-radius: 999px;
        background: rgba(148, 163, 184, 0.12);
        color: #e2e8f0;
      }
      .pill strong {
        color: #fbbf24;
        font-weight: 700;
      }
      .grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
        gap: 10px;
        margin-top: 18px;
      }
      .card {
        border-radius: 14px;
        padding: 14px;
        background: rgba(255, 255, 255, 0.04);
        border: 1px solid rgba(148, 163, 184, 0.12);
      }
      .card h3 {
        margin: 0 0 6px 0;
        font-size: 14px;
        color: #cbd5e1;
        text-transform: uppercase;
        letter-spacing: 0.04em;
      }
      .card p {
        margin: 0;
        font-size: 22px;
        font-weight: 700;
        color: #e2e8f0;
      }
      .order {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-top: 6px;
      }
      .badge {
        padding: 8px 10px;
        border-radius: 10px;
        background: rgba(148, 163, 184, 0.14);
        color: #f8fafc;
        font-weight: 600;
        font-size: 14px;
      }
      .badge.serving {
        background: linear-gradient(135deg, #f59e0b, #fbbf24);
        color: #0f172a;
      }
      .muted {
        color: #cbd5e1;
        font-size: 14px;
      }
      .error {
        color: #fecdd3;
      }
      footer {
        margin-top: 16px;
        font-size: 12px;
        color: #94a3b8;
      }
    </style>
  </head>
  <body>
    <div class="shell">
      <header>
        <div>
          <div class="title">Read-only Raffle Board</div>
          <div class="meta">
            <span class="pill">Isolated view • Port ${port}</span>
            <span class="pill">Polls every ${pollIntervalMs / 1000}s</span>
          </div>
        </div>
        <div class="meta">
          <span class="pill">Source: data/state.json</span>
          <span class="pill" id="timestamp">Waiting for data…</span>
        </div>
      </header>

      <div class="grid">
        <div class="card">
          <h3>Now Serving</h3>
          <p id="serving">—</p>
        </div>
        <div class="card">
          <h3>Ticket Range</h3>
          <p id="range">—</p>
        </div>
        <div class="card">
          <h3>Mode</h3>
          <p id="mode">—</p>
        </div>
        <div class="card">
          <h3>Total Tickets</h3>
          <p id="count">—</p>
        </div>
      </div>

      <div class="card" style="margin-top: 18px;">
        <h3>Drawing Order</h3>
        <div class="order" id="order"></div>
        <div class="muted" id="status" style="margin-top: 8px;">Polling for latest state…</div>
      </div>

      <footer>Read-only page. No writes or controls are exposed from this server.</footer>
    </div>

    <script>
      const statusEl = document.getElementById("status");
      const servingEl = document.getElementById("serving");
      const rangeEl = document.getElementById("range");
      const modeEl = document.getElementById("mode");
      const countEl = document.getElementById("count");
      const orderEl = document.getElementById("order");
      const timestampEl = document.getElementById("timestamp");

      const renderState = (state) => {
        const { startNumber, endNumber, mode, generatedOrder, currentlyServing, timestamp } = state;
        servingEl.textContent = currentlyServing ?? "Waiting";
        rangeEl.textContent =
          startNumber && endNumber ? startNumber + "–" + endNumber : "Not set";
        modeEl.textContent = mode ?? "—";
        countEl.textContent =
          startNumber && endNumber ? endNumber - startNumber + 1 : "—";

        orderEl.innerHTML = "";
        if (!generatedOrder || generatedOrder.length === 0) {
          const badge = document.createElement("div");
          badge.className = "badge";
          badge.textContent = "No tickets generated yet";
          orderEl.appendChild(badge);
        } else {
          generatedOrder.forEach((value) => {
            const badge = document.createElement("div");
            badge.className = "badge";
            if (value === currentlyServing) {
              badge.classList.add("serving");
            }
            badge.textContent = value;
            orderEl.appendChild(badge);
          });
        }

        const updated = timestamp ? new Date(timestamp).toLocaleTimeString() : "—";
        timestampEl.textContent = "Updated: " + updated;
      };

      const fetchState = async () => {
        statusEl.textContent = "Refreshing…";
        statusEl.classList.remove("error");
        try {
          const response = await fetch("/state", { cache: "no-store" });
          if (!response.ok) {
            throw new Error("Unable to load state");
          }
          const payload = await response.json();
          renderState(payload);
          statusEl.textContent = "Last checked: " + new Date().toLocaleTimeString();
        } catch (error) {
          statusEl.textContent = "Error loading state: " + (error?.message ?? "Unknown error");
          statusEl.classList.add("error");
        }
      };

      fetchState();
      setInterval(fetchState, ${pollIntervalMs});
    </script>
  </body>
</html>`;

const sendJson = (res, body, status = 200) => {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(body));
};

const sendHtml = (res) => {
  res.writeHead(200, {
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(htmlPage);
};

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname === "/state") {
    const state = await loadState();
    sendJson(res, state);
    return;
  }

  if (url.pathname === "/healthz") {
    sendJson(res, { status: "ok" });
    return;
  }

  sendHtml(res);
});

server.listen(port, () => {
  console.log(
    `Read-only raffle server listening on http://localhost:${port} (polling every ${pollIntervalMs}ms)`,
  );
  console.log(`Reading state from: ${statePath}`);
});

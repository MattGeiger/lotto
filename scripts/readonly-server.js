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
const publicDir = path.join(process.cwd(), "public");

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
    <title>Food Pantry Service</title>
    <style>
      :root {
        color-scheme: dark;
        font-family: "Inter", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        background: #000;
        color: #f8fafc;
      }
      body {
        margin: 0;
        min-height: 100vh;
        display: flex;
        align-items: flex-start;
        justify-content: center;
        padding: 32px;
        background: radial-gradient(circle at 20% 20%, rgba(59, 130, 246, 0.18), transparent 32%),
          radial-gradient(circle at 80% 0%, rgba(59, 130, 246, 0.12), transparent 28%),
          linear-gradient(145deg, #000, #0a0a0a 45%, #000);
      }
      .shell {
        width: min(1400px, calc(100vw - 48px));
        margin: 0 auto;
        padding: 0;
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
        font-size: 28px;
        font-weight: 800;
        letter-spacing: -0.02em;
        color: #fff;
      }
      .eyebrow {
        font-size: 12px;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: #cbd5e1;
      }
      .stamp {
        padding: 8px 14px;
        border-radius: 14px;
        background: #111;
        border: 1px solid #444;
        color: #f8fafc;
        font-size: 13px;
      }
      .grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
        gap: 10px;
        margin-top: 18px;
      }
      .card {
        border-radius: 14px;
        padding: 14px;
        background: #0b0b0b;
        border: 1px solid #2d2d2d;
        text-align: center;
      }
      .card h3 {
        margin: 0 0 6px 0;
        font-size: 14px;
        color: #e5e7eb;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        text-align: center;
      }
      .card p {
        margin: 0;
        font-size: 26px;
        font-weight: 700;
        color: #fff;
        line-height: 1.2;
      }
      .now-serving-card p {
        font-size: 96px;
        line-height: 1.12;
        font-weight: 900;
        color: #fbbf24;
        background: linear-gradient(135deg, #f59e0b, #fbbf24);
        -webkit-background-clip: text;
        background-clip: text;
        -webkit-text-fill-color: transparent;
      }
      .order {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(96px, 1fr));
        gap: 12px;
        margin-top: 10px;
      }
      .badge {
        padding: 14px 18px;
        border-radius: 12px;
        background: #0f172a;
        border: 1px solid #1f2937;
        color: #f8fafc;
        font-weight: 800;
        font-size: 22px;
        line-height: 1.2;
        display: flex;
        align-items: center;
        justify-content: center;
        text-align: center;
        }
      .badge.serving {
        background: linear-gradient(135deg, #f59e0b, #fbbf24);
        border-color: #fbbf24;
        color: #0b0b0b;
      }
      .badge.served {
        background: linear-gradient(135deg, #10b981, #22d3ee);
        border-color: #22d3ee;
        color: #022c22;
      }
      .badge.upcoming {
        background: #0b0b0b;
        border-color: #0f172a;
        color: #94a3b8;
        opacity: 0.7;
      }
      .logo {
        display: flex;
        justify-content: flex-start;
        margin-bottom: 8px;
      }
      .logo img {
        max-width: min(320px, 45vw);
        width: min(320px, 45vw);
        height: auto;
      }
      .top-row {
        display: grid;
        grid-template-columns: auto 1fr auto;
        align-items: center;
        gap: 12px;
        margin-bottom: 12px;
        text-align: center;
      }
      .now-serving-card {
        justify-self: center;
        min-width: 200px;
      }
      .now-serving-card {
        border-color: transparent;
      }
      .spacer {
        width: min(320px, 45vw);
        height: 1px;
      }
      @media (max-width: 640px) {
        .top-row {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
        }
        .logo {
          justify-content: center;
        }
        .spacer {
          display: none;
        }
      }
      .muted {
        color: #e5e7eb;
        font-size: 14px;
      }
      .empty-state {
        margin-top: 12px;
        padding: 16px;
        text-align: center;
        font-size: 36px;
        line-height: 1.25;
        font-weight: 800;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 6px;
      }
      .empty-state .line {
        display: block;
        width: 100%;
      }
      .error {
        color: #fb7185;
      }
      footer {
        margin-top: 16px;
        font-size: 12px;
        color: #e5e7eb;
      }
    </style>
  </head>
  <body>
    <div class="shell">
      <div class="top-row">
        <div class="logo">
          <img src="/wth-logo-horizontal-reverse.png" alt="William Temple House" />
        </div>
        <div class="card now-serving-card" style="margin: 0 auto;">
          <h3>Now Serving</h3>
          <p id="serving">—</p>
        </div>
        <div class="spacer" aria-hidden="true"></div>
      </div>
      <header>
        <div>
          <div class="eyebrow">Food Pantry Service For</div>
          <div class="title" id="page-title">—</div>
        </div>
        <div class="stamp" id="timestamp">Updated: —</div>
      </header>

      <div class="grid">
        <div class="card">
          <h3>Tickets Issued Today</h3>
          <p id="range">—</p>
        </div>
        <div class="card">
          <h3>Mode</h3>
          <p id="mode">—</p>
        </div>
        <div class="card">
          <h3>Total Tickets Issued</h3>
          <p id="count">—</p>
        </div>
      </div>

      <div class="card" style="margin-top: 18px;">
        <h3>Drawing Order</h3>
        <div class="muted empty-state" id="empty-state">
          <span class="line">Welcome!</span>
          <span class="line">The raffle has not yet started.</span>
          <span class="line">Check back soon for updates.</span>
        </div>
        <div class="order" id="order"></div>
        <div class="muted" id="status" style="margin-top: 8px;">Polling for latest state…</div>
      </div>

    </div>

    <script>
      const statusEl = document.getElementById("status");
      const servingEl = document.getElementById("serving");
      const rangeEl = document.getElementById("range");
      const modeEl = document.getElementById("mode");
      const countEl = document.getElementById("count");
      const orderEl = document.getElementById("order");
      const emptyStateEl = document.getElementById("empty-state");
      const timestampEl = document.getElementById("timestamp");
      const pageTitleEl = document.getElementById("page-title");

      const formatDate = () => {
        const now = new Date();
        const weekday = now.toLocaleString("en-US", { weekday: "long" });
        const day = now.getDate();
        const month = now.toLocaleString("en-US", { month: "long" });
        const year = now.getFullYear();

        const suffix = (() => {
          const remainder = day % 100;
          if (remainder >= 11 && remainder <= 13) return "th";
          switch (day % 10) {
            case 1:
              return "st";
            case 2:
              return "nd";
            case 3:
              return "rd";
            default:
              return "th";
          }
        })();

        return weekday + ", " + month + " " + day + suffix + ", " + year;
      };

      const setTitle = () => {
        const formatted = formatDate();
        pageTitleEl.textContent = formatted;
        document.title = "Food Pantry Service For " + formatted;
      };

      const renderState = (state) => {
        const { startNumber, endNumber, mode, generatedOrder, currentlyServing, timestamp } = state;
        servingEl.textContent = currentlyServing ?? "Waiting";
        rangeEl.textContent =
          startNumber && endNumber ? startNumber + " – " + endNumber : "Not set";
        modeEl.textContent =
          mode === "random" ? "Raffle" : mode === "sequential" ? "Sequential" : "—";
        countEl.textContent =
          startNumber && endNumber ? endNumber - startNumber + 1 : "—";

        orderEl.innerHTML = "";
        const currentIndex =
          generatedOrder && currentlyServing !== null
            ? generatedOrder.indexOf(currentlyServing)
            : -1;
        const hasTickets = generatedOrder && generatedOrder.length > 0;
        if (emptyStateEl) {
          emptyStateEl.style.display = hasTickets ? "none" : "block";
        }
        if (hasTickets) {
          generatedOrder.forEach((value, index) => {
            const badge = document.createElement("div");
            badge.className = "badge";
            if (value === currentlyServing) {
              badge.classList.add("serving");
            } else if (currentIndex !== -1 && index < currentIndex) {
              badge.classList.add("served");
            } else if (currentIndex !== -1 && index > currentIndex) {
              badge.classList.add("upcoming");
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

      setTitle();
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

const tryServeStatic = async (pathname, res) => {
  const safePath = path.normalize(pathname).replace(/^(\.\.[/\\])+/, "");
  const filePath = path.join(publicDir, safePath);
  if (!filePath.startsWith(publicDir)) return false;
  try {
    const data = await fs.readFile(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const mime =
      ext === ".png"
        ? "image/png"
        : ext === ".jpg" || ext === ".jpeg"
          ? "image/jpeg"
          : "application/octet-stream";
    res.writeHead(200, { "Content-Type": mime, "Cache-Control": "public, max-age=3600" });
    res.end(data);
    return true;
  } catch {
    return false;
  }
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

  if (await tryServeStatic(url.pathname, res)) {
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

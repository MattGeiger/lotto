"use client";

import React from "react";

import type { RaffleState } from "@/lib/state-types";

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

  return `${weekday}, ${month} ${day}${suffix}, ${year}`;
};

const formatMode = (mode?: RaffleState["mode"]) => {
  if (mode === "random") return "Raffle";
  if (mode === "sequential") return "Sequential";
  return "—";
};

export const ReadOnlyDisplay = () => {
  const [state, setState] = React.useState<RaffleState | null>(null);
  const [status, setStatus] = React.useState("Polling for latest state…");
  const [hasError, setHasError] = React.useState(false);

  const formattedDate = React.useMemo(() => formatDate(), []);

  const fetchState = React.useCallback(async () => {
    setStatus("Refreshing…");
    setHasError(false);
    try {
      const response = await fetch("/api/state", { cache: "no-store" });
      if (!response.ok) {
        throw new Error("Unable to load state");
      }
      const payload = (await response.json()) as RaffleState;
      setState(payload);
      setStatus(`Last checked: ${new Date().toLocaleTimeString()}`);
    } catch (error) {
      setStatus(`Error loading state: ${error instanceof Error ? error.message : "Unknown error"}`);
      setHasError(true);
    }
  }, []);

  React.useEffect(() => {
    fetchState();
    const interval = setInterval(fetchState, 4000);
    return () => clearInterval(interval);
  }, [fetchState]);

  React.useEffect(() => {
    document.title = `Food Pantry Service For ${formattedDate}`;
  }, [formattedDate]);

  const startNumber = state?.startNumber ?? 0;
  const endNumber = state?.endNumber ?? 0;
  const generatedOrder = state?.generatedOrder ?? [];
  const currentlyServing = state?.currentlyServing ?? null;
  const currentIndex =
    generatedOrder && currentlyServing !== null ? generatedOrder.indexOf(currentlyServing) : -1;
  const hasTickets = generatedOrder.length > 0;
  const updatedTime = state?.timestamp ? new Date(state.timestamp).toLocaleTimeString() : "—";

  return (
    <div className="shell">
      <div className="top-row">
        <div className="logo">
          <img src="/wth-logo-horizontal-reverse.png" alt="William Temple House" />
        </div>
        <div className="card now-serving-card" style={{ margin: "0 auto" }}>
          <h3>Now Serving</h3>
          <p id="serving">{currentlyServing ?? "Waiting"}</p>
        </div>
        <div className="spacer" aria-hidden="true" />
      </div>
      <header>
        <div>
          <div className="eyebrow">Food Pantry Service For</div>
          <div className="title" id="page-title">
            {formattedDate}
          </div>
        </div>
        <div className="stamp" id="timestamp">
          Updated: {updatedTime}
        </div>
      </header>

      <div className="grid">
        <div className="card">
          <h3>Tickets Issued Today</h3>
          <p id="range">{startNumber && endNumber ? `${startNumber} – ${endNumber}` : "Not set"}</p>
        </div>
        <div className="card">
          <h3>Mode</h3>
          <p id="mode">{formatMode(state?.mode)}</p>
        </div>
        <div className="card">
          <h3>Total Tickets Issued</h3>
          <p id="count">{startNumber && endNumber ? endNumber - startNumber + 1 : "—"}</p>
        </div>
      </div>

      <div className="card" style={{ marginTop: 18 }}>
        <h3>Drawing Order</h3>
        {!hasTickets && (
          <div className="muted empty-state" id="empty-state">
            <span className="line">Welcome!</span>
            <span className="line">The raffle has not yet started.</span>
            <span className="line">Check back soon for updates.</span>
          </div>
        )}
        <div className="order" id="order">
          {generatedOrder.map((value, index) => {
            const classes = ["badge"];
            if (value === currentlyServing) {
              classes.push("serving");
            } else if (currentIndex !== -1 && index < currentIndex) {
              classes.push("served");
            } else if (currentIndex !== -1 && index > currentIndex) {
              classes.push("upcoming");
            }
            return (
              <div className={classes.join(" ")} key={value}>
                {value}
              </div>
            );
          })}
        </div>
        <div className={`muted ${hasError ? "error" : ""}`} id="status" style={{ marginTop: 8 }}>
          {status}
        </div>
      </div>

      <style jsx>{`
        :global(body) {
          margin: 0;
          min-height: 100vh;
          display: flex;
          align-items: flex-start;
          justify-content: center;
          padding: 32px;
          background: radial-gradient(
              circle at 20% 20%,
              rgba(59, 130, 246, 0.18),
              transparent 32%
            ),
            radial-gradient(circle at 80% 0%, rgba(59, 130, 246, 0.12), transparent 28%),
            linear-gradient(145deg, #000, #0a0a0a 45%, #000);
          color: #f8fafc;
          font-family: "Inter", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          color-scheme: dark;
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
      `}</style>
    </div>
  );
};

# William Temple House — Digital Raffle & Queue Board

Next.js (App Router) app with ShadCN-inspired UI, JSON persistence, and atomic backups to digitize the pantry raffle flow.

## Features
- Staff dashboard (`/admin`) to set ranges, toggle random vs sequential, append tickets, re-randomize, update “now serving,” and reset with confirmations.
- Public display (`/display`) with airport-style grid and QR code sharing (no auto-polling to avoid interrupting form entry).
- Isolated read-only board server (`npm run readonly`) on its own port that polls the JSON state and exposes zero write paths.
- File-based datastore with atomic writes, timestamped backups, and append logic that preserves prior random order.
- Tests written with Vitest + Testing Library for the state manager and grid highlighting.

## Scripts
- `npm run dev` — start the Next.js dev server.
- `npm run build` — production build.
- `npm start` — run the built app.
- `npm run readonly` — start the standalone read-only board on port 4000 (configurable via `READONLY_PORT`).
- `npm test` — run Vitest suite.
- `npm run lint` — run ESLint.

## Read-only board server
- Runs on a separate port (default `4000`) and serves a static view that polls `data/state.json` every 4s.
- Defaults to a high-contrast, read-only display suitable for wall screens.
- No controls or writes are exposed—purely a viewer for wall displays or embeds.
- Displays the WTH horizontal logo at the top of the read-only board.
- Configure via env vars:
  - `READONLY_PORT` — port to listen on (default `4000`).
  - `READONLY_POLL_MS` — poll interval in milliseconds (default `4000`).
  - `READONLY_DATA_DIR` — directory containing `state.json` (default `./data`).
- Start it alongside the main app:
  ```bash
  npm run readonly
  # open http://localhost:4000
  ```

## Persistence
- State stored under `data/state.json` with timestamped backup files (`state-YYYYMMDDHHMMSSmmm-XXXXXX.json`).
- Data dir is ignored by Git except for `data/.gitkeep` to preserve the folder.

## Run in Docker
- Build and start locally (includes a bind mount for persistent `data/`):
  ```bash
  docker compose up --build
  ```
- App listens on `http://localhost:3000` (staff dashboard `/admin`, public board `/display`).
- Stored state lives in your host `./data` directory so it survives container restarts.

## Tech
- Next.js 16 (App Router) + Tailwind CSS.
- ShadCN-style UI components (Radix + cva).
- Vitest + Testing Library.

## Theme / design tokens
- Global palette and design tokens live in `src/app/globals.css` (`--color-primary`, surfaces, borders, focus, status colors).
- UI components (buttons, badges, cards, inputs, switches, tooltips) consume those tokens rather than hard-coded colors. Update tokens to change app-wide styling.
- The public display no longer shows a mode pill; mode selection is still managed in the admin controls but not surfaced in the UI chrome.
- Snapshot history: admin can undo/redo and restore from timestamped snapshots (backed by `data/state-*.json` files) via `/api/state` actions and UI controls.

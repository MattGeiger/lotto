# William Temple House — Digital Raffle & Queue Board

Next.js (App Router) app with ShadCN-inspired UI, JSON persistence, and atomic backups to digitize the pantry raffle flow.

## Features
- Staff dashboard (`/admin`) to set ranges, toggle random vs sequential, append tickets, re-randomize, update “now serving,” and reset with confirmations.
- Public display (`/display`) with airport-style grid, live polling, and QR code sharing.
- File-based datastore with atomic writes, timestamped backups, and append logic that preserves prior random order.
- Tests written with Vitest + Testing Library for the state manager and grid highlighting.

## Scripts
- `npm run dev` — start the Next.js dev server.
- `npm run build` — production build.
- `npm start` — run the built app.
- `npm test` — run Vitest suite.
- `npm run lint` — run ESLint.

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

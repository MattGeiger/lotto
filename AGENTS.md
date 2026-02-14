# AGENTS.md

## Purpose
This file captures repo-specific guidance for coding agents so changes stay
consistent with existing patterns and workflows.

## Project Snapshot
- Next.js 16 App Router, TypeScript/TSX only.
- UI uses shadcn/ui (style: new-york) with Tailwind CSS variables.
- Global design tokens live in `src/app/globals.css`.
- Auth: NextAuth magic link + OTP, emails via Resend.
- Data: Neon Postgres in production; local `data/state.json` for dev fallback.
- Toasts: `sonner` with UI wrapper in `src/components/ui/sonner`.

## Repo Map
- `src/` app code (App Router, components, hooks, lib).
- `public/` static assets.
- `data/` local dev data (gitignored except `.gitkeep`).
- `tests/` Vitest + Testing Library.
- `docs/` documentation and runbooks.
- `scripts/` helper scripts.

## Commands
- `npm run dev` start Next.js dev server.
- `npm run build` production build.
- `npm start` run built app.
- `npm run readonly` optional standalone display on port 4000.
- `npm test` Vitest suite.
- `npm run lint` ESLint.
- `docker compose up --build` full local stack (app + Postgres + MailDev).

## Conventions
- Use shadcn/ui components in `src/components/ui` where possible.
- Prefer Tailwind tokens from `src/app/globals.css`; avoid hard-coded colors.
- Keep UI logic in TS/TSX; no JSX files.
- User-facing notifications should use `sonner` toasts unless an existing
  pattern dictates otherwise.

## Arcade Guardrails
- Keep Arcade explicitly separated from raffle/display features in both code and UX.
- Do not integrate Arcade gameplay into `/` or `src/components/readonly-display.tsx`.
- Do not reuse raffle-specific UI/state concepts for Arcade (ticket cards, queue legends, raffle statuses).
- Arcade visuals should use simple pixel-art direction with Arcade-specific components.
- Place Arcade routes under `src/app/(arcade)/arcade/*`.
- Keep existing raffle/admin/login/staff routes under `src/app/(core)/*` as work progresses.
- Place Arcade feature code under `src/arcade/*` (`components`, `ui`, `game`, `hooks`, `lib`, `types`, `styles`).
- Scope Arcade styles to Arcade route/layout files; avoid broad global theme changes in `src/app/globals.css`.
- If using 8bitcn, install and consume it in an Arcade-only scope; do not overwrite global `theme-provider` or shared app theming.

## Deploy and Branching
- Production is the Vercel project for `williamtemple.app`.
- Use `dev` for staging/testing unless directed otherwise.

## Agent Workflow (Adapted Commandments)
1. State whether changes are WITHIN existing patterns or AGAINST them. If
   against, discuss options and rationale before editing.
2. Explore the repo before editing: use `rg --files`, `rg`, `ls`, `sed -n`,
   and read relevant files. Do not assume paths or behavior.
3. Verify destination paths exist before editing. Create directories with
   `mkdir -p` before adding new files.
4. Read existing files fully before editing. For related files, open all of
   them before making changes.
5. Prefer line-based edits with `apply_patch` for existing files. Avoid full
   rewrites unless necessary.
6. Never use placeholders; write complete code and configs.
7. Update `CHANGELOG.md` and other docs with line-based edits; do not overwrite.
8. Discuss major architecture, dependency, or framework changes before acting.
9. If you need the user to run commands, provide the absolute path and exact
   command, then wait for their output before proceeding.
10. Avoid destructive git commands; do not revert unrelated changes. Check
    `git status` and work with the current state.
11. Prefer `rg` over `grep` for search.

## Testing
Run relevant tests when changing behavior. If tests are skipped, say why and
suggest how to validate.

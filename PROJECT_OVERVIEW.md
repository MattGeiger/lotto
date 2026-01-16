# William Temple House — Digital Raffle System
## Project Overview & Architecture Documentation

**Status:** Production (v1.1.0)  
**Deployment:** https://williamtemple.app  

---

## 1. Executive Summary

The William Temple House Digital Raffle system replaces a manual coffee-can raffle with a production-grade web application. Built through collaborative AI agent development, the system is designed to serve ~150 daily pantry clients with:

- **Fair, transparent queue management** via randomized ticket drawing
- **Multi-device access** (wall screens + mobile via QR codes)  
- **Staff-friendly administration** with undo/redo and snapshot history
- **Enterprise-grade security** (magic link + OTP authentication, domain-restricted)
- **Automated data hygiene** (snapshot cleanup, retention policies)
- **Multilingual public display** with language switcher (English, 中文, Español, Русский, Українська, Tiếng Việt, فارسی, العربية) and RTL support for Arabic/Farsi

**Tech Stack:** Next.js 16, React 19, Neon Postgres, Resend email, Vercel hosting

---

## 2. Problem Solved

### Original Pain Points
- Morning line disputes and crowd surges at gate opening
- Manual whiteboard updates
- No remote visibility for clients
- Labor-intensive analog process

### Solution Delivered
- Automated randomized drawing with transparent display
- Real-time updates via polling (public board) and admin controls
- QR code sharing for mobile access
- Durable Postgres storage with atomic writes
- Single or multiple staff/volunteer operation capability

---

## 3. System Architecture

### 3.1 Frontend (Next.js 16 App Router)
- **Public Display** (`/`) — High-contrast wall-screen UI, auto-polling every 30s
- **Staff Dashboard** (`/admin`) — Range management, append, mode toggle, undo/redo
- **Authentication** (`/login`) — Magic link + OTP fallback
- **Staff Landing** (`/staff`) — Welcome page with dashboard link

### 3.2 Backend (Next.js API Routes)
- `/api/state` — CRUD operations for raffle state (generate, append, update serving)
- `/api/state/cleanup` — Snapshot retention management (7/30-day policies)
- `/api/auth/[...nextauth]` — NextAuth v5 handlers (magic link, OTP, session)
- `/api/auth/otp/request` — Rate-limited OTP generation with email delivery

### 3.3 Data Layer (Neon Postgres)
- **raffle_state** — Current lottery state (singleton record, JSONB payload)
- **raffle_snapshots** — Timestamped backups for undo/redo (retention policies)
- **users/accounts/sessions** — NextAuth authentication tables
- **verification_token** — Magic link tokens (10-min expiry, hashed)
- **otp_failures** — Rate limiting and lockout tracking (5 attempts, 5-min lockout; 1/minute request throttle)

**Connection Pool:** Shared singleton pool (`@neondatabase/serverless`) to prevent auth/OTP connection exhaustion

### 3.4 Email Delivery (Resend)
- **Sender:** `login@williamtemple.app` (verified domain)
- **Templates:** React Email components (branded OTP; magic link uses NextAuth default template)
- **Fallback:** Local MailDev SMTP for Docker development

### 3.5 Deployment (Vercel)
- **Production:** `williamtemple.app` (custom domain, Vercel DNS)
- **Runtime:** Node.js (proxy.ts, API routes)
- **Monitoring:** Vercel Speed Insights, build logs
- **CI/CD:** GitHub main branch auto-deploy

---

## 4. Core Features (Implemented)

### 4.1 Raffle Generation
- **Random mode:** Fisher-Yates shuffle for initial range; new tickets are batch-shuffled and appended to the end.
- **Sequential mode:** First-come-first-serve order; new tickets append to the end.
- **Mode protection:** Switching modes requires confirmation, preserves existing order.

### 4.2 Queue Management
- **"Now Serving" control:** Step through draw positions with prev/next arrows
- **Ordinal display:** "1st", "2nd", "3rd" draw position labels
- **Clear position:** Reset to start (requires confirmation)
- **Returned tickets:** Staff can mark a ticket as returned; status is stored, returned tickets are excluded from wait-time estimates, and returning the current ticket auto-advances to the next available draw position
- **Unclaimed tickets:** Staff can mark a called ticket as unclaimed; status is surfaced on the live board for staff/client clarity

### 4.3 History & Recovery
- **Undo/Redo:** Navigate snapshot history (ordered by timestamp)
- **Snapshot restore:** Select and restore from dropdown
- **Automatic backups:** Created on every state change
- **Retention policies:** 7-day or 30-day cleanup via admin UI (auto-runs on reset)

### 4.4 Security & Access Control
- **Domain restriction:** Only `@williamtemple.org` emails allowed
- **Dual authentication:** Magic link (primary) + OTP fallback (rate-limited)
- **Route protection:** `/admin` and write APIs require session (proxy.ts middleware)
- **Token security:** Hashed verification tokens, 10-minute expiry
- **Rate limiting:** 1 OTP request/minute, 5 attempts before 10-minute lockout

### 4.5 Data Hygiene
- **Snapshot cleanup:** Keep last 7 or 30 days via admin UI; auto-cleanup (30 days) runs on reset.
- **Storage capacity:** ~1.9 MB for 30-day retention, ~440 KB for 7-day.
- **Neon free tier:** 512 MB limit with ample runway under retention policies.

### 4.6 Display & Sharing
- **QR code generation:** Admin-configurable URL (defaults to production domain)
- **High-contrast UI:** Gold/blue gradients, 8rem "NOW SERVING" headline
- **Responsive grid:** Served tickets highlighted, upcoming muted
- **Status legend:** Legend clarifies not called / now serving / called / unclaimed / returned tickets
- **Ticket detail messaging:** Tapping a ticket shows called-time context or returned/unclaimed guidance
- **Empty state:** Welcoming message when no tickets issued

---

## 5. Data Model

### 5.1 Raffle State (JSONB in raffle_state table)
```json
{
  "startNumber": 640,
  "endNumber": 690,
  "mode": "random",
  "generatedOrder": [689, 650, 677, ...],
  "currentlyServing": 689,
  "ticketStatus": { "650": "returned", "651": "unclaimed" },
  "calledAt": { "689": 1732723847123 },
  "orderLocked": true,
  "timestamp": 1732723847123,
  "displayUrl": "https://williamtemple.app/"
}
```

### 5.2 Snapshots (raffle_snapshots table)
- **id:** UUID primary key
- **payload:** JSONB (full raffle state)
- **created_at:** Timestamp (indexed DESC for undo/redo ordering)

### 5.3 Authentication Tables
- **users:** Email (unique), emailVerified timestamp
- **verification_token:** Hashed identifier, hashed token, 10-min expires
- **otp_failures:** Email, failed attempts, locked until timestamp
- **sessions:** sessionToken, userId, expires

---

## 6. Operational Behavior

### 6.1 Daily Workflow
1. Staff logs in via magic link (`/login` → email → click → `/staff` landing)
2. Navigate to `/admin`, enter ticket range (e.g., 640-690), choose mode (random)
3. Click "Generate order" → randomized sequence created, snapshot saved
4. Display QR code on wall screen, clients scan to view on phones
5. Step through "Now Serving" with arrows as clients approach counter
6. Mark returned tickets if a client leaves (auto-advances if currently serving); mark unclaimed tickets after a number is called
7. Append additional tickets mid-day if queue grows (new tickets randomized within order)
8. End of day: Click "Reset for New Day" (requires "RESET" confirmation, auto-cleanups 30-day snapshots)

### 6.2 Append Logic
- **Random mode:** New tickets are shuffled as a batch and appended to the end.
- **Sequential mode:** New tickets appended to end in order.
- **Order preservation:** Existing tickets never re-shuffled.

### 6.3 Mode Toggle
- **Confirmation required:** Modal warns existing order stays intact
- **Future tickets only:** Mode switch affects append behavior, not current draw

### 6.4 Cleanup Automation
- **Manual triggers:** "Keep last 7 days" or "Keep last 30 days" buttons with destructive confirmations.
- **Auto-cleanup:** Runs on reset (30-day retention).
- **Success feedback:** Alert shows deletion count.

---

## 7. Security Considerations

### 7.1 Authentication
- **No personal data:** Only ticket numbers (anonymous)
- **Domain allowlist:** `@williamtemple.org` enforced in sign-in callback
- **Token security:** SHA-256 hashed, 10-minute expiry, single-use
- **OTP lockout:** 5 failed attempts → 5-minute cooldown; 1 request per minute throttle

### 7.2 Infrastructure
- **Connection pooling:** Shared Neon pool prevents auth/OTP exhaustion
- **Atomic writes:** Postgres UPSERT for raffle_state, INSERT for snapshots
- **Environment isolation:** `AUTH_BYPASS=false` in production, local Docker for dev

### 7.3 CSRF & Session Security
- **NextAuth CSRF protection:** Built-in token validation
- **Session cookies:** HTTP-only, secure in production
- **Middleware guards:** `/admin` and write APIs check session before execution

---

## 8. Deployment & Operations

### 8.1 Production Environment
- **Hosting:** Vercel (Node.js runtime, serverless functions)
- **Database:** Neon Postgres (512 MB free tier, shared pool)
- **Email:** Resend (100 emails/day free tier)
- **Domain:** `williamtemple.app` (Vercel DNS, custom domain)
- **Monitoring:** Vercel Speed Insights, build logs

### 8.2 Local Development
- **Docker Compose:** App + Postgres + MailDev (SMTP UI at localhost:1080)
- **Auth bypass:** `AUTH_BYPASS=true` for UI work (still requires `DATABASE_URL`)
- **File storage:** Falls back to `data/state.json` when `DATABASE_URL` absent

### 8.3 CI/CD Pipeline
1. Push to GitHub `main` branch
2. Vercel auto-builds (Next.js 16, Turbopack)
3. Environment variables injected from Vercel dashboard
4. Deploy to production (`williamtemple.app`)
5. Verify Speed Insights collecting data

---

## 9. Lessons Learned

### 9.1 Technical Decisions
- **Postgres over JSON files:** Vercel filesystem is ephemeral, Neon free tier sufficient
- **Shared connection pool:** Critical for preventing auth/OTP connection exhaustion
- **Magic link + OTP:** Email scanner issues required fallback (IT email scanning breaks magic links)
- **Proxy.ts migration:** Next.js 16 breaking change, runtime cannot be configured
- **Snapshot cleanup:** Essential for staying within Neon 512 MB free tier

### 9.2 Development Workflow
- **Three-person team:** Geiger (lead), Claude (supervisor), Codex (implementer)
- **Zero-shot build:** AI agent collaboration from spec to production
- **Incremental deployment:** Phase-by-phase verification (local → Vercel preview → custom domain → full auth)
- **Compliance audits:** Systematic file inspection for Vercel 2025 standards

### 9.3 Production Surprises
- **IT email scanning:** Magic links opened by security scanners, requiring OTP fallback
- **Neon pooling:** Separate pools per auth/OTP call caused exhaustion, needed singleton
- **SQL syntax:** Neon parameterized queries require `make_interval()`, not string interpolation
- **Next.js 16 changes:** Middleware → proxy.ts, runtime declarations forbidden in proxy files

---

## 10. Future Enhancements (Optional)

### 10.1 Observability
- **Error tracking:** Sentry free tier or Neon `errors` table (avoid PII)
- **Health checks:** `/api/health` endpoint for uptime monitoring
- **Snapshot metrics:** Dashboard showing cleanup stats, storage usage

### 10.2 User Experience
- **WebSocket updates:** Replace polling with real-time push (Socket.IO or Pusher)
- **Flipboard animations:** CSS transitions for "Now Serving" changes
- **Multilingual support:** Spanish translations for client-facing UI
- **Accessibility mode:** High contrast, dyslexia-friendly fonts

### 10.3 Operations
- **Automated retention:** Vercel Cron job (2 free on Hobby) for daily snapshot cleanup
- **DMARC/SPF/DKIM:** Complete DNS records for `williamtemple.app` email domain
- **Backup strategy:** Periodic Neon database snapshots, external archival

---

## 11. Project Artifacts

### 11.1 Documentation
- `README.md` — Setup, scripts, deployment runbook
- `CHANGELOG.md` — Version history, feature timeline
- `PROJECT_OVERVIEW.md` — This document (architecture, design decisions)
- `docs/UI_DESIGN.md` — Theme system, design tokens

### 11.2 Key Files
- `/src/proxy.ts` — Authentication middleware (Next.js 16)
- `/src/lib/state-manager-db.ts` — Postgres-backed state manager
- `/src/lib/auth.ts` — NextAuth v5 configuration
- `/src/app/api/state/route.ts` — Core raffle API
- `/src/app/api/auth/otp/request/route.ts` — Rate-limited OTP generation

### 11.3 Configuration
- `.env.example` — Environment variable template
- `docker-compose.yml` — Local development stack
- `next.config.ts` — Next.js 16 config (Turbopack, React 19)
- `tailwind.config.ts` — Tailwind v4, design tokens

---

## 12. Acknowledgments

Built through collaborative AI agent development:
- **Geiger:** Project lead, UX and interaction design requirements, decision-making
- **Claude Sonnet 4.5:** Technical supervisor, architecture, debugging
- **Codex 5.1:** Code implementer, testing, commits

---

**Version:** 1.1.0 
**Last Updated:** January 13, 2026  
**Status:** Production, serving William Temple House food pantry operations

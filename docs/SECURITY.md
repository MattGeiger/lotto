# Security Audit Report

**Application:** William Temple House Digital Raffle System
**Date:** 2026-02-09
**Auditor:** Automated security review (Claude)
**Scope:** Full codebase review of `/Users/russbook/lotto`
**Status:** Review complete. All findings approved for fixing.

---

## Summary

| Severity | Count | Approved |
|----------|-------|----------|
| High     | 2     | 2        |
| Medium   | 5     | 5        |
| Low      | 5     | 5        |

---

## High Severity

### H1. Insecure Randomness for Raffle Shuffle ✅ Approved

**File:** `src/lib/state-manager-db.ts:17`
**Description:** The Fisher-Yates shuffle that determines raffle ticket order uses `Math.random()`, which is not cryptographically secure. For a lottery/raffle system where fairness is critical, this is a significant concern.

```typescript
const j = Math.floor(Math.random() * (i + 1));
```

`Math.random()` uses a PRNG (xorshift128+ in V8) that is deterministic and predictable if the internal state is known. An attacker with knowledge of the engine state could predict or reconstruct the shuffle order.

**Impact:** The raffle draw order could theoretically be predicted, undermining the fairness guarantee of the lottery system.
**Recommendation:** Use `crypto.randomInt()` (already imported elsewhere in the codebase for OTP generation) instead of `Math.random()` for the shuffle.

---

### H2. AUTH_BYPASS Environment Variable Can Disable All Authentication ✅ Approved

**Files:** `src/proxy.ts:16-18`, `src/app/admin/layout.tsx:11-12`, `src/lib/auth.ts:173-176`
**Description:** When `AUTH_BYPASS=true` is set, all authentication is completely disabled across the entire application — middleware, admin layout, and sign-in callbacks all skip auth checks.

```typescript
// proxy.ts — middleware skips auth entirely
const authBypass = process.env.AUTH_BYPASS === "true";
if ((isAdmin || isWriteApi) && !authBypass) { ... }

// admin/layout.tsx — admin page renders without session check
if (process.env.AUTH_BYPASS === "true") {
  return <>{children}</>;
}

// auth.ts — any email can sign in
if (bypassAuth) { return true; }
```

There is no runtime guard that prevents this variable from being set in production. If a Vercel environment variable is misconfigured or if the variable leaks into a deployment, the entire admin surface is exposed.

**Impact:** Complete authentication bypass — any user can access admin functions, manipulate the raffle, reset state, or delete snapshots.
**Recommendation:** Add an explicit guard that throws a fatal error if `AUTH_BYPASS=true` and `NODE_ENV=production`. Consider removing the bypass entirely and using a test-specific auth mock instead.

---

## Medium Severity

### M1. No Rate Limiting on State Mutation Endpoints ✅ Approved

**File:** `src/app/api/state/route.ts`
**Description:** The POST `/api/state` endpoint accepts any of 15+ action types (generate, reset, undo, redo, restore, append, etc.) with no rate limiting. While the middleware requires authentication for POST requests, a compromised or shared staff session could spam mutations. Rate limiting provides defense-in-depth against a worst-case scenario where a bad actor gains access to the admin surface.

**Impact:** Rapid-fire requests could create unbounded snapshot rows in the database, exhaust Neon's free-tier storage, or cause a denial-of-service condition for other staff users.
**Recommendation:** Add per-session rate limiting on mutation endpoints (e.g., max 30 requests/minute).

---

### M2. `setDisplayUrl` Accepts Any URL Scheme ✅ Approved

**Files:** `src/app/api/state/route.ts:57`, `src/app/admin/page.tsx:368-406`
**Description:** The Zod schema validates the display URL with `z.string().max(64).url().nullable()`, which accepts any syntactically valid URL including `javascript:`, `data:`, and `file://` schemes. The admin page has a client-side check using `new URL()` but does not validate the scheme.

**Note:** The display URL is currently only consumed by `QRCode.toCanvas()` in `readonly-display.tsx`, which renders it as a QR code image — not as an `<a href>` or via `innerHTML`. A `javascript:` URL in a QR code is inert (phones don't execute JavaScript from QR scans). The actual XSS risk is minimal, but scheme restriction is a reasonable hardening measure.

**Impact:** Low practical risk given current usage, but accepting arbitrary URL schemes is unnecessarily permissive.
**Recommendation:** Restrict the URL scheme to `https://` only (or `http://` for development).

---

### M3. No Content Security Policy (CSP) Headers ✅ Approved

**File:** `next.config.ts`
**Description:** No Content Security Policy headers are configured. The application renders user-controlled data (ticket numbers, display URL, operating hours) on public-facing pages.

**Note:** The app has a small XSS surface — no `dangerouslySetInnerHTML`, no inline scripts, no external CDN resources in the browser. The only external resource is a Google Fonts import in the OTP email template, which is server-rendered and never runs in the browser. CSP is defense-in-depth against future mistakes.

**Impact:** Without CSP, any XSS vulnerability (current or future) has unrestricted access to execute arbitrary scripts, exfiltrate data, or redirect users.
**Recommendation:** Add a strict CSP via Next.js `headers()` config, restricting `script-src`, `style-src`, and `connect-src` to trusted origins.

**Implementation note:** Next.js requires `'unsafe-inline'` for both `script-src` and `style-src` because the framework injects inline scripts for hydration and inline styles for component rendering. A nonce-based approach (`'nonce-<random>'`) would be stricter but requires custom Next.js middleware to inject a fresh nonce per request. The current policy uses `'unsafe-inline'` as a pragmatic baseline.

---

### M4. Weak Validation on `OperatingHours` and `timezone` Inputs ✅ Approved

**File:** `src/app/api/state/route.ts:63-66`
**Description:** The `setOperatingHours` action uses a permissive custom Zod validator that accepts any truthy value:

```typescript
z.object({
  action: z.literal("setOperatingHours"),
  hours: z.custom<OperatingHours>((value) => Boolean(value)),
  timezone: z.string(),
})
```

The `timezone` field accepts any arbitrary string with no validation against IANA timezone identifiers.

**Impact:** Invalid or malformed operating hours data could corrupt application state. An arbitrary timezone string could cause unexpected behavior in the polling strategy, potentially keeping the public display in a permanent "closed" state or bypassing operating-hours logic.
**Recommendation:** Validate `hours` against the `OperatingHours` type shape with a proper Zod schema. Validate `timezone` against `Intl.supportedValuesOf("timeZone")` or a known IANA timezone list.

---

### M5. NextAuth v5 Beta Dependency — Permissive Semver Range ✅ Approved

**File:** `package.json`
**Description:** The application uses `next-auth@^5.0.0-beta.25` (resolved to `5.0.0-beta.30`). NextAuth v5 has been in beta since 2023 with no stable release. The library is now in maintenance mode, with the Auth.js team focusing on the better-auth successor. The beta is widely used in production and considered production-ready by the community.

**Impact:** The caret range `^5.0.0-beta.25` allows npm to auto-upgrade to newer betas on install, which could introduce breaking changes or regressions silently.
**Recommendation:** Pin to an exact version (`5.0.0-beta.30`) to prevent surprise upgrades. Long-term, evaluate migration to better-auth or another stable auth library.

---

## Low Severity

### L1. Error Details Leaked to Clients ✅ Approved

**Files:** `src/app/api/state/route.ts:74-77`, `src/app/api/state/route.ts:143-146`, `src/app/api/state/cleanup/route.ts:44-48`
**Description:** API error responses include `details: String(error)`, which serializes the full error message (and potentially stack trace) to the client.

```typescript
return NextResponse.json(
  { error: "Unable to load state", details: String(error) },
  { status: 500 },
);
```

**Impact:** Error details may reveal internal implementation details, database connection strings, file paths, or library versions to attackers.
**Recommendation:** Log full errors server-side with `console.error`. Return only generic error messages to clients in production. Error messages should follow the ASK model: **A**ctionable, **S**pecific, **K**ind — give the user enough information to understand the problem and know what to do, without verbose jargon or echoed internal output.

---

### L2. Email Addresses Logged in Server Output ✅ Approved

**Files:** `src/lib/auth.ts:177`, `src/app/api/auth/otp/request/route.ts:131`
**Description:** User email addresses are logged during authentication flows:

```typescript
console.log("[Auth] signIn callback", { email: user.email });
console.log("[OTP] Code issued", { email });
```

**Note:** Only `@williamtemple.org` staff emails appear in these logs — there are no public sign-ups. The blast radius is limited, but PII is PII.

**Impact:** In serverless environments (Vercel), logs may be retained and accessible to anyone with project access. Email addresses are PII subject to privacy regulations.
**Recommendation:** Truncate emails to first two characters (e.g., `mg***@williamtemple.org`) to preserve debugging utility while protecting PII.

---

### L3. Standalone Read-Only Server Has Redundant Path Traversal Protection ✅ Approved

**File:** `scripts/readonly-server.js:476-478`
**Description:** The static file server uses a dual protection approach:

```javascript
const safePath = path.normalize(pathname).replace(/^(\.\.[/\\])+/, "");
const filePath = path.join(publicDir, safePath);
if (!filePath.startsWith(publicDir)) return false;
```

The regex only strips leading `../` sequences, not embedded traversal segments. The `path.join` + `startsWith` check is the actual defense. The regex provides a false sense of additional security.

**Impact:** Low risk — the `startsWith` check prevents actual directory escapes. However, the redundant regex could create confusion during maintenance.
**Recommendation:** Remove the regex and rely solely on `path.resolve` + `startsWith`, which is the canonical Node.js pattern for path traversal prevention.

---

### L4. `trustHost: true` Set Unconditionally in Auth Config ✅ Approved

**File:** `src/lib/auth.ts:188`
**Description:** The NextAuth config sets `trustHost: true` unconditionally:

```typescript
trustHost: true,
```

This tells NextAuth to trust the `Host` and `X-Forwarded-Host` headers from the request. While required on Vercel (which sets these headers), it should ideally be scoped to the production environment.

**Impact:** In a misconfigured deployment behind a proxy that doesn't sanitize forwarded headers, this could enable host header injection attacks for callback URL manipulation.
**Recommendation:** Set `trustHost` conditionally: `trustHost: process.env.VERCEL === "1"` or use the `AUTH_TRUST_HOST` env var that already exists in `.env.example`.

---

### L5. No Explicit Source Map Protection ✅ Approved

**File:** `next.config.ts`
**Description:** The Next.js config does not explicitly set `productionBrowserSourceMaps: false`. Next.js already defaults to `false`, so the current behavior is secure — this is about making the intent explicit.

**Impact:** If source maps were accidentally enabled in the future, the full TypeScript source code would be visible in browser DevTools, revealing business logic and potential vulnerabilities.
**Recommendation:** Explicitly set `productionBrowserSourceMaps: false` in `next.config.ts` for defense-in-depth.

---

## Secure Patterns Observed

The following areas were reviewed and found to be properly implemented:

- **SQL Injection:** All database queries use parameterized statements via Neon's tagged template literals. No raw string interpolation in SQL.
- **OTP Implementation:** Uses `crypto.randomInt()` for code generation, SHA-256 hashing for token storage, 10-minute expiry, rate limiting (5 attempts / 5-minute lockout, 1 request/minute cooldown).
- **Input Validation:** Zod schemas validate all API request bodies with discriminated unions. Ticket numbers are validated as positive integers within range.
- **Secrets Management:** No secrets committed to git history. `.env` files are properly gitignored. Only `.env.example` and `.env.production.example` are tracked.
- **Session Strategy:** JWT-based sessions avoid server-side session storage issues. Domain-restricted email sign-in (`@williamtemple.org` only).
- **Database Timeouts:** All DB operations have configurable timeout protection (default 5s) to prevent hanging connections.
- **CORS:** Default Next.js same-origin policy is in effect. No overly permissive CORS headers.
- **Write Protection:** Middleware (`proxy.ts`) correctly gates all POST/PUT/DELETE requests to `/api/state` behind authentication.

---

## Approved Fixes (Priority Order)

All 12 findings have been reviewed. All are approved for fixing.

| # | Finding | Severity | Fix |
|---|---------|----------|-----|
| 1 | H1 — Insecure shuffle randomness | High | Replace `Math.random()` with `crypto.randomInt()` |
| 2 | H2 — AUTH_BYPASS has no production guard | High | Throw fatal error if `AUTH_BYPASS=true` in production |
| 3 | M1 — No rate limiting on mutations | Medium | Add per-session throttle on state mutation endpoints |
| 4 | M2 — Display URL accepts any scheme | Medium | Restrict to `https://` (or `http://` in dev) |
| 5 | M3 — No CSP headers | Medium | Add Content Security Policy via Next.js `headers()` |
| 6 | M4 — Weak operating hours validation | Medium | Replace `z.custom` with proper Zod schema; validate timezone against IANA list |
| 7 | M5 — Permissive NextAuth beta semver | Medium | Pin to exact version `5.0.0-beta.30` |
| 8 | L1 — Error details leaked to clients | Low | Log full errors server-side; return ASK-model messages to clients |
| 9 | L2 — PII in server logs | Low | Truncate emails to two characters (e.g., `mg***@williamtemple.org`) |
| 10 | L3 — Redundant path traversal regex | Low | Remove regex; rely on `path.resolve` + `startsWith` |
| 11 | L4 — `trustHost` set unconditionally | Low | Set conditionally: `trustHost: !!process.env.VERCEL` |
| 12 | L5 — No explicit source map protection | Low | Add `productionBrowserSourceMaps: false` to `next.config.ts` |

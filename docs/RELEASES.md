# William Temple House Digital Raffle System v1.0.4

**Release Date:** December 12, 2025

## Authentication (OTP-First)

- Updated the `/login` authentication card so **One-Time Passcode (OTP)** is the default sign-in method.
- Swapped tab order so **OTP appears on the left** and **Magic Link appears on the right** (Magic Link remains available as a fallback).

## Important IT Limitation (Magic Links)

- Magic links are currently not viable in the staff environment because Microsoft Defender (CCSI) automatically inspects links in email bodies and burns the single-use token before the user clicks it.
- Recommended and supported method: ➡️ **One-Time Passcode (OTP)**.

## Documentation

- Added technical documentation at `docs/AUTHENTICATION.md` covering supported methods, domain restriction (`@williamtemple.org`), the Defender limitation, and the OTP flow.

## Versioning & UI

- Bumped application version to **1.0.4**.
- Updated the staff landing page to display the version from `package.json` (prevents stale hardcoded version strings).

## Maintenance (Lint Warning Cleanup)

- Resolved existing lint warnings by removing unused imports/variables and applying Next.js image guidance (replaced logo `<img>` tags with `next/image` on the read-only display).

# Authentication

## Supported Methods

- One-Time Passcode (OTP) (email-based)
- Magic Link (email-based)

## Local Development Behavior

- On localhost development (`npm run dev`), authentication is bypassed automatically.
- OTP and Magic Link flows are required in production deployments.

## Email Restriction

- Only `@williamtemple.org` email addresses are accepted.
- All other email domains are rejected automatically.

## Important IT Limitation

- Magic links are currently not viable. CCSI uses Microsoft Defender, which screens all links
  contained in an email body. This inspection protocol is automatic and burns the single-use token
  embedded in the Magic Link.
- Microsoft Defender preemptively clicks and invalidates the link tokens.
- Disabling Defender is not acceptable from a cybersecurity standpoint.

## Recommended And Supported Method

➡️ One-Time Passcode (OTP)

## OTP Flow

1. User enters their `@williamtemple.org` email address.
2. A 6-digit numeric code is emailed.
3. User copies and pastes the code into the app.
4. A secure authentication cookie is stored in the browser.

Users do not need to repeat this process each time.

## Maintenance Notes

- This document was updated alongside small non-functional code cleanups to resolve lint warnings
  (unused imports/variables and Next.js image component guidance).

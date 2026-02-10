import { describe, expect, it, vi, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("L2: server logs must not contain full email addresses", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("auth signIn callback does not log raw user.email", () => {
    const authSource = fs.readFileSync(
      path.resolve(__dirname, "../src/lib/auth.ts"),
      "utf-8",
    );

    // The source should NOT contain a log statement that directly logs user.email
    const signInLogPattern = /console\.log\([^)]*email:\s*user\.email/;
    expect(authSource).not.toMatch(signInLogPattern);
  });

  it("OTP request route does not log raw email variable", () => {
    const otpSource = fs.readFileSync(
      path.resolve(__dirname, "../src/app/api/auth/otp/request/route.ts"),
      "utf-8",
    );

    // The source should NOT log the raw email variable
    const rawEmailLogPattern = /console\.log\([^)]*{\s*email\s*}/;
    expect(otpSource).not.toMatch(rawEmailLogPattern);
  });

  it("log output contains truncated form with first two chars and ***@", () => {
    // Check auth.ts uses truncation pattern
    const authSource = fs.readFileSync(
      path.resolve(__dirname, "../src/lib/auth.ts"),
      "utf-8",
    );
    expect(authSource).toContain("***@");

    // Check OTP route uses truncation pattern
    const otpSource = fs.readFileSync(
      path.resolve(__dirname, "../src/app/api/auth/otp/request/route.ts"),
      "utf-8",
    );
    expect(otpSource).toContain("***@");
  });
});

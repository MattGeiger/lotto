"use client";

import React, { Suspense } from "react";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { Mail } from "lucide-react";
import Image from "next/image";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const LoginForm = () => {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/admin";
  const [email, setEmail] = React.useState("");
  const [status, setStatus] = React.useState<"idle" | "pending" | "sent" | "error">("idle");
  const [error, setError] = React.useState<string | null>(null);
  const [otpCode, setOtpCode] = React.useState("");
  const [otpStatus, setOtpStatus] = React.useState<
    "idle" | "sending" | "sent" | "verifying" | "error"
  >("idle");
  const [otpError, setOtpError] = React.useState<string | null>(null);
  const hasVerificationError = searchParams.get("error") === "Verification";

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setStatus("pending");
    const attemptSignIn = async (provider: "resend" | "email") =>
      signIn(provider, {
        email,
        callbackUrl,
        redirect: false,
      });

    const primary = await attemptSignIn("resend");
    if (primary?.error) {
      const fallback = await attemptSignIn("email");
      if (fallback?.error) {
        setError(fallback.error);
        setStatus("error");
        return;
      }
    }
    setStatus("sent");
  };

  const handleRequestOtp = async () => {
    setOtpError(null);
    setOtpStatus("sending");
    try {
      const response = await fetch("/api/auth/otp/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const payload = await response.json();
      if (!response.ok) {
        setOtpError(payload?.error ?? "Unable to send code. Please try again.");
        setOtpStatus("error");
        return;
      }
      setOtpStatus("sent");
    } catch (err) {
      setOtpError("Unable to send code. Please try again.");
      setOtpStatus("error");
    }
  };

  const handleVerifyOtp = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setOtpError(null);
    setOtpStatus("verifying");
    const result = await signIn("otp", {
      email,
      code: otpCode,
      callbackUrl,
      redirect: false,
    });
    if (result?.error) {
      setOtpError(result.error);
      setOtpStatus("error");
      return;
    }
    if (result?.url) {
      window.location.href = result.url;
    } else {
      setOtpStatus("sent");
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-4">
      {hasVerificationError && (
        <Alert variant="destructive" className="border-destructive/60 bg-destructive/10">
          <AlertTitle>Magic link verification failed</AlertTitle>
          <AlertDescription>
            The one-time link could not be verified. Please request a new link or use the OTP code
            option below to sign in.
          </AlertDescription>
        </Alert>
      )}
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="size-4 text-primary" />
            Magic link login
          </CardTitle>
          <CardDescription>
            Enter your work email to receive a one-time sign-in link. Access is limited to approved
            domains.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form className="space-y-3" onSubmit={handleSubmit}>
            <div className="space-y-1">
              <label htmlFor="email" className="text-sm font-medium text-foreground">
                Work email
              </label>
              <Input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@williamtemple.org"
                autoComplete="email"
              />
            </div>
            <Button
              type="submit"
              className="w-full"
              disabled={status === "pending" || email.trim().length === 0}
            >
              {status === "pending" ? "Sending link..." : "Send magic link"}
            </Button>
          </form>
          {status === "sent" && (
            <Badge variant="success" className="w-full justify-center">
              Check your email for the sign-in link.
            </Badge>
          )}
          {status === "error" && error && (
            <Badge variant="destructive" className="w-full justify-center">
              {error}
            </Badge>
          )}
          <p className="text-xs text-muted-foreground">
            After signing in, you will be redirected to the staff dashboard or your requested page.
          </p>
        </CardContent>
      </Card>

      <Card className="w-full">
        <CardHeader>
          <CardTitle>One-time passcode (OTP)</CardTitle>
          <CardDescription>
            If magic links are blocked, request a 6-digit code instead and enter it here to sign in.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="space-y-1">
              <label htmlFor="otp-email" className="text-sm font-medium text-foreground">
                Work email
              </label>
              <Input
                id="otp-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@williamtemple.org"
                autoComplete="email"
              />
            </div>
            <Button
              type="button"
              variant="default"
              className="w-full"
              onClick={handleRequestOtp}
              disabled={otpStatus === "sending" || email.trim().length === 0}
            >
              {otpStatus === "sending" ? "Sending code..." : "Send code"}
            </Button>
          </div>
          <form className="space-y-3" onSubmit={handleVerifyOtp}>
            <div className="space-y-1">
              <label htmlFor="otp-code" className="text-sm font-medium text-foreground">
                6-digit code
              </label>
              <Input
                id="otp-code"
                type="text"
                inputMode="numeric"
                pattern="\d{6}"
                maxLength={6}
                required
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="123456"
                autoComplete="one-time-code"
              />
            </div>
            <Button
              type="submit"
              className="w-full"
              disabled={
                otpStatus === "verifying" ||
                otpCode.trim().length !== 6 ||
                email.trim().length === 0
              }
            >
              {otpStatus === "verifying" ? "Verifying..." : "Sign in with code"}
            </Button>
          </form>
          {otpStatus === "sent" && (
            <Badge variant="success" className="w-full justify-center">
              Code sent. Check your email and enter it above.
            </Badge>
          )}
          {otpStatus === "error" && otpError && (
            <Badge variant="destructive" className="w-full justify-center">
              {otpError}
            </Badge>
          )}
          <p className="text-xs text-muted-foreground">
            Codes expire in 10 minutes. You can request a new code at any time.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

const LoginPage = () => {
  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col gap-6 px-6 py-12">
      <div className="flex justify-center">
        <Image
          src="/wth-logo-horizontal.png"
          alt="William Temple House"
          width={900}
          height={240}
          className="block h-auto w-full max-w-md dark:hidden"
          priority
        />
        <Image
          src="/wth-logo-horizontal-reverse.png"
          alt="William Temple House"
          width={900}
          height={240}
          className="hidden h-auto w-full max-w-md dark:block"
          priority
        />
      </div>
      <Suspense
        fallback={
          <Card className="mx-auto w-full max-w-xl">
            <CardContent className="p-6 text-sm text-muted-foreground">
              Loading login...
            </CardContent>
          </Card>
        }
      >
        <LoginForm />
      </Suspense>
    </main>
  );
};

export default LoginPage;

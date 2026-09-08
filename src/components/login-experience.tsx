// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 Matt Geiger, Temple Consulting, LLC.
//
// LOTTO — Line Order Transparency & Ticketing Organizer. Application code
// licensed under AGPL-3.0-or-later; see LICENSE. William Temple House branding
// is not covered by this license; see TRADEMARKS.md.

"use client";

import React, { Suspense } from "react";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { KeyRound, Mail } from "lucide-react";
import { toast } from "sonner";

import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Tabs,
  TabsContent,
  TabsContents,
  TabsHighlight,
  TabsHighlightItem,
  TabsList,
  TabsTrigger,
} from "@/components/animate-ui/primitives/animate/tabs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { BrandLogo } from "@/components/brand-logo";
import { useBrand } from "@/contexts/brand-context";
import { MAGIC_LINK_EXPIRY_MINUTES, OTP_EXPIRY_MINUTES } from "@/lib/auth-constants";

const LOGIN_TABS_IDS = {
  otpTrigger: "login-tabs-trigger-otp",
  magicTrigger: "login-tabs-trigger-magic",
  otpContent: "login-tabs-content-otp",
  magicContent: "login-tabs-content-magic",
} as const;

function LoginForm() {
  const brandProfile = useBrand();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/admin";

  const [email, setEmail] = React.useState("");
  const [magicStatus, setMagicStatus] = React.useState<"idle" | "sending" | "sent" | "error">("idle");
  const [magicError, setMagicError] = React.useState<string | null>(null);

  const [otpCode, setOtpCode] = React.useState("");
  const [otpStatus, setOtpStatus] = React.useState<
    "idle" | "requesting" | "requestFailed" | "sent" | "verifying" | "verificationFailed"
  >("idle");
  const [otpError, setOtpError] = React.useState<string | null>(null);

  const hasVerificationError = searchParams.get("error") === "Verification";

  React.useEffect(() => {
    if (hasVerificationError) {
      toast.error(
        "The magic link could not be verified. Try requesting a new link or use the OTP code instead.",
      );
    }
  }, [hasVerificationError]);

  const handleEmailChange = (value: string) => {
    setEmail(value);
    setMagicStatus("idle");
    setMagicError(null);
    setOtpStatus("idle");
    setOtpCode("");
    setOtpError(null);
  };

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setMagicStatus("sending");
    setMagicError(null);
    try {
      const result = await signIn("resend", {
        email,
        callbackUrl,
        redirect: false,
      });
      if (result?.error) {
        throw new Error("LOTTO could not send the sign-in link. Check the email and try again.");
      }
      setMagicStatus("sent");
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "LOTTO could not send the sign-in link. Check the email and try again.";
      toast.error(message);
      setMagicError(message);
      setMagicStatus("error");
    }
  };

  const handleRequestOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setOtpCode("");
    setOtpStatus("requesting");
    setOtpError(null);
    try {
      const response = await fetch("/api/auth/otp/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.error || "Unable to send code. Please try again.");
      }
      setOtpStatus("sent");
      if (
        process.env.NODE_ENV !== "production" &&
        data &&
        typeof data.devCode === "string" &&
        data.devCode.length > 0
      ) {
        toast(`Development OTP code: ${data.devCode}`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to send code. Please try again.";
      toast.error(message);
      setOtpError(message);
      setOtpStatus("requestFailed");
    }
  };

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setOtpStatus("verifying");
    setOtpError(null);
    const result = await signIn("otp", {
      email,
      code: otpCode,
      callbackUrl,
      redirect: false,
    });
    if (result?.error) {
      const message = "That verification code is incorrect or expired. Request a new code and try again.";
      toast.error(message);
      setOtpError(message);
      setOtpStatus("verificationFailed");
      return;
    }
    if (result?.url) {
      window.location.href = result.url;
    }
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="px-8 pt-7 sm:px-10 sm:pt-8">
        <CardTitle>{brandProfile.staff.signInTitle}</CardTitle>
        <CardDescription>{brandProfile.staff.emailGuidance}</CardDescription>
      </CardHeader>

      <CardContent className="px-8 pb-7 sm:px-10 sm:pb-8">
        <Tabs defaultValue="magic" className="w-full">
          <TabsHighlight className="absolute inset-0 rounded-[calc(var(--radius)-7px)] border border-border/45 bg-background/80 shadow-sm backdrop-blur-sm supports-[backdrop-filter]:bg-background/55">
            <TabsList className="grid w-full grid-cols-2">
              <TabsHighlightItem value="magic">
                <TabsTrigger
                  value="magic"
                  id={LOGIN_TABS_IDS.magicTrigger}
                  aria-controls={LOGIN_TABS_IDS.magicContent}
                  className="flex w-full items-center gap-2"
                >
                  <Mail className="size-4" />
                  Magic Link
                </TabsTrigger>
              </TabsHighlightItem>
              <TabsHighlightItem value="otp">
                <TabsTrigger
                  value="otp"
                  id={LOGIN_TABS_IDS.otpTrigger}
                  aria-controls={LOGIN_TABS_IDS.otpContent}
                  className="flex w-full items-center gap-2"
                >
                  <KeyRound className="size-4" />
                  Verification Code
                </TabsTrigger>
              </TabsHighlightItem>
            </TabsList>
          </TabsHighlight>

          <TabsContents className="px-3 pb-2 sm:px-4">
            <TabsContent
              value="magic"
              id={LOGIN_TABS_IDS.magicContent}
              aria-labelledby={LOGIN_TABS_IDS.magicTrigger}
              className="space-y-4"
            >
              <form onSubmit={handleMagicLink} className="space-y-3">
                <div className="space-y-2">
                  <label htmlFor="email-magic" className="text-sm font-medium">
                    Work email
                  </label>
                  <Input
                    id="email-magic"
                    type="email"
                    value={email}
                    onChange={(e) => handleEmailChange(e.target.value)}
                    placeholder={brandProfile.staff.emailPlaceholder}
                    className="px-4"
                    autoComplete="email"
                    required
                  />
                </div>
                <Button type="submit" className="w-full px-5" disabled={magicStatus === "sending"}>
                  {magicStatus === "sending" ? "Sending..." : "Send magic link"}
                </Button>
              </form>

              {magicStatus === "sent" && (
                <Alert>
                  <AlertDescription>
                    Check your email for the sign-in link. It expires in {MAGIC_LINK_EXPIRY_MINUTES}
                    {" "}minutes.
                  </AlertDescription>
                </Alert>
              )}
              {magicError && (
                <Alert variant="destructive">
                  <AlertDescription>{magicError}</AlertDescription>
                </Alert>
              )}
            </TabsContent>

            <TabsContent
              value="otp"
              id={LOGIN_TABS_IDS.otpContent}
              aria-labelledby={LOGIN_TABS_IDS.otpTrigger}
              className="space-y-4"
            >
              {otpStatus === "idle" || otpStatus === "requesting" || otpStatus === "requestFailed" ? (
                <form onSubmit={handleRequestOTP} className="space-y-3">
                  <div className="space-y-2">
                    <label htmlFor="email-otp" className="text-sm font-medium">
                      Work email
                    </label>
                    <Input
                      id="email-otp"
                      type="email"
                      value={email}
                      onChange={(e) => handleEmailChange(e.target.value)}
                      placeholder={brandProfile.staff.emailPlaceholder}
                      className="px-4"
                      autoComplete="email"
                      required
                    />
                  </div>
                  <Button
                    type="submit"
                    className="w-full px-5"
                    disabled={otpStatus === "requesting" || email.trim().length === 0}
                  >
                    {otpStatus === "requesting" ? "Sending..." : "Send 6-digit code"}
                  </Button>
                  {otpError && (
                    <Alert variant="destructive">
                      <AlertDescription>{otpError}</AlertDescription>
                    </Alert>
                  )}
                </form>
              ) : (
                <form onSubmit={handleVerifyOTP} className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Enter code</label>
                    <InputOTP
                      maxLength={6}
                      value={otpCode}
                      onChange={(value) => {
                        setOtpCode(value);
                        setOtpError(null);
                        if (otpStatus === "verificationFailed") setOtpStatus("sent");
                      }}
                      className="w-full"
                      autoComplete="one-time-code"
                    >
                      <InputOTPGroup className="gap-2.5">
                        {[0, 1, 2, 3, 4, 5].map((idx) => (
                          <InputOTPSlot key={idx} index={idx} className="data-[active]:border-primary" />
                        ))}
                      </InputOTPGroup>
                    </InputOTP>
                    <p className="text-xs text-muted-foreground">Code sent to {email}</p>
                    <p className="text-xs text-muted-foreground">
                      The code expires in {OTP_EXPIRY_MINUTES} minutes.
                    </p>
                  </div>
                  {otpError && (
                    <Alert variant="destructive">
                      <AlertDescription>{otpError}</AlertDescription>
                    </Alert>
                  )}
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setOtpStatus("idle");
                        setOtpCode("");
                        setOtpError(null);
                      }}
                      className="flex-1 px-4"
                    >
                      Change email
                    </Button>
                    <Button
                      type="submit"
                      className="flex-1 px-4"
                      disabled={otpStatus === "verifying" || otpCode.length !== 6}
                    >
                      {otpStatus === "verifying" ? "Verifying..." : "Verify"}
                    </Button>
                  </div>
                </form>
              )}
            </TabsContent>
          </TabsContents>
        </Tabs>
      </CardContent>
    </Card>
  );
}

/**
 * The shared staff login screen (brand logo + magic-link/OTP form), used by both
 * `/login` and `/staff`. An optional `footer` slot carries the version /
 * About / Help links.
 */
export function LoginExperience({
  banner,
  footer,
}: {
  banner?: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-4xl flex-col items-center justify-start gap-6 px-6 py-8 sm:justify-center sm:py-12">
      {banner}
      <div className="flex justify-center">
        <BrandLogo className="w-full max-w-md" priority />
      </div>
      <Suspense fallback={<div className="text-sm text-muted-foreground">Loading login...</div>}>
        <LoginForm />
      </Suspense>
      {footer}
    </main>
  );
}

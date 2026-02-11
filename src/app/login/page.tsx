"use client";

import React, { Suspense } from "react";
import Image from "next/image";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { KeyRound, Mail } from "lucide-react";
import { toast } from "sonner";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const LoginForm = () => {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/admin";

  const [email, setEmail] = React.useState("");
  const [magicStatus, setMagicStatus] = React.useState<"idle" | "sending" | "sent" | "error">(
    "idle",
  );

  const [otpCode, setOtpCode] = React.useState("");
  const [otpStatus, setOtpStatus] = React.useState<
    "idle" | "requesting" | "sent" | "verifying" | "error"
  >("idle");

  const hasVerificationError = searchParams.get("error") === "Verification";

  React.useEffect(() => {
    if (hasVerificationError) {
      toast.error(
        "The magic link could not be verified. Try requesting a new link or use the OTP code instead.",
      );
    }
  }, [hasVerificationError]);

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setMagicStatus("sending");
    const result = await signIn("resend", {
      email,
      callbackUrl,
      redirect: false,
    });
    if (result?.error) {
      toast.error(result.error);
      setMagicStatus("error");
      return;
    }
    setMagicStatus("sent");
  };

  const handleRequestOTP = async () => {
    setOtpCode("");
    setOtpStatus("requesting");
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
      toast.error(err instanceof Error ? err.message : "Unable to send code. Please try again.");
      setOtpStatus("error");
    }
  };

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setOtpStatus("verifying");
    const result = await signIn("otp", {
      email,
      code: otpCode,
      callbackUrl,
      redirect: false,
    });
    if (result?.error) {
      toast.error(result.error);
      setOtpStatus("error");
      return;
    }
    if (result?.url) {
      window.location.href = result.url;
    }
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Sign in to William Temple House</CardTitle>
        <CardDescription>Staff access only — use your @williamtemple.org email.</CardDescription>
      </CardHeader>

      <CardContent>
        <Tabs defaultValue="otp" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="otp" className="flex items-center gap-2">
              <KeyRound className="size-4" />
              OTP Code
            </TabsTrigger>
            <TabsTrigger value="magic" className="flex items-center gap-2">
              <Mail className="size-4" />
              Magic Link
            </TabsTrigger>
          </TabsList>

          <TabsContent value="magic" className="mt-4 space-y-4">
            <form onSubmit={handleMagicLink} className="space-y-3">
              <div className="space-y-2">
                <label htmlFor="email-magic" className="text-sm font-medium">
                  Work email
                </label>
                <Input
                  id="email-magic"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@williamtemple.org"
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={magicStatus === "sending"}>
                {magicStatus === "sending" ? "Sending..." : "Send magic link"}
              </Button>
            </form>

            {magicStatus === "sent" && (
              <Alert>
                <AlertDescription>
                  Check your email for the sign-in link. It expires in 10 minutes.
                </AlertDescription>
              </Alert>
            )}
          </TabsContent>

          <TabsContent value="otp" className="mt-4 space-y-4">
            {otpStatus === "idle" || otpStatus === "requesting" ? (
              <div className="space-y-3">
                <div className="space-y-2">
                  <label htmlFor="email-otp" className="text-sm font-medium">
                    Work email
                  </label>
                  <Input
                    id="email-otp"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@williamtemple.org"
                    required
                  />
                </div>
                <Button
                  type="button"
                  onClick={handleRequestOTP}
                  className="w-full"
                  disabled={otpStatus === "requesting" || email.trim().length === 0}
                >
                  {otpStatus === "requesting" ? "Sending..." : "Send 6-digit code"}
                </Button>
              </div>
            ) : (
              <>
                <form onSubmit={handleVerifyOTP} className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Enter code</label>
                    <InputOTP
                      maxLength={6}
                      value={otpCode}
                      onChange={(value) => setOtpCode(value)}
                      className="w-full"
                    >
                      <InputOTPGroup className="gap-2.5">
                        {[0, 1, 2, 3, 4, 5].map((idx) => (
                          <InputOTPSlot
                            key={idx}
                            index={idx}
                            className="data-[active]:border-primary"
                          />
                        ))}
                      </InputOTPGroup>
                    </InputOTP>
                    <p className="text-xs text-muted-foreground">Code sent to {email}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setOtpStatus("idle");
                        setOtpCode("");
                      }}
                      className="flex-1"
                    >
                      Change email
                    </Button>
                    <Button
                      type="submit"
                      className="flex-1"
                      disabled={otpStatus === "verifying" || otpCode.length !== 6}
                    >
                      {otpStatus === "verifying" ? "Verifying..." : "Verify"}
                    </Button>
                  </div>
                </form>
              </>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

const LoginPage = () => {
  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col items-center justify-center gap-6 px-6 py-12">
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
      <Suspense fallback={<div className="text-sm text-muted-foreground">Loading login...</div>}>
        <LoginForm />
      </Suspense>
    </main>
  );
};

export default LoginPage;

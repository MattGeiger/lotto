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

const LoginForm = () => {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/admin";
  const [email, setEmail] = React.useState("");
  const [status, setStatus] = React.useState<"idle" | "pending" | "sent" | "error">("idle");
  const [error, setError] = React.useState<string | null>(null);

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

  return (
    <Card className="mx-auto w-full max-w-xl">
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
          <Button type="submit" className="w-full" disabled={status === "pending"}>
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

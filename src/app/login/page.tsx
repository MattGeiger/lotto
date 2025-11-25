"use client";

import React, { Suspense } from "react";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { Mail } from "lucide-react";

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
    const result = await signIn("email", {
      email,
      callbackUrl,
      redirect: false,
    });
    if (result?.error) {
      setError(result.error);
      setStatus("error");
    } else {
      setStatus("sent");
    }
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
          <Badge variant="secondary" className="badge-success w-full justify-center">
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

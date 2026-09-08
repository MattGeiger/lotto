// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 Matt Geiger, Temple Consulting, LLC.

import Link from "next/link";

import { BetaEnvironmentBanner } from "@/components/beta-environment-banner";
import { BrandLogo } from "@/components/brand-logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = {
  title: "Confirm sign in",
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const firstValue = (value: string | string[] | undefined): string =>
  Array.isArray(value) ? (value[0] ?? "") : (value ?? "");

/**
 * The human half of the Magic Link flow.
 *
 * Rendering this page consumes nothing. Do not add an effect, redirect, or
 * automatic form submission: inbound-mail scanners fetch and render links,
 * and an automatic POST would hand the single-use token straight back to the
 * bot. The explicit button press is the security boundary.
 */
export default async function ConfirmSignInPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const provider = firstValue(params.provider);
  const token = firstValue(params.token);
  const email = firstValue(params.email);
  const callbackUrl = firstValue(params.callbackUrl) || "/admin";
  const providerIsValid = provider === "resend" || provider === "email";
  const isComplete = providerIsValid && token.length > 0 && email.length > 0;

  const callbackParams = new URLSearchParams({ token, email, callbackUrl });
  const callbackAction = `/api/auth/callback/${provider}?${callbackParams.toString()}`;

  return (
    <main className="mx-auto flex min-h-dvh max-w-4xl flex-col items-center justify-start gap-6 px-6 py-8 sm:justify-center sm:py-12">
      <BetaEnvironmentBanner />
      <div className="flex justify-center">
        <BrandLogo className="w-full max-w-md" priority />
      </div>

      <Card className="w-full max-w-md">
        <CardHeader className="px-8 pt-7 sm:px-10 sm:pt-8">
          <CardTitle>{isComplete ? "Confirm sign in" : "That link is incomplete"}</CardTitle>
          <CardDescription>
            {isComplete
              ? `Continue to sign in as ${email}.`
              : "The sign-in link may have expired or been broken across lines by your email program."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 px-8 pb-7 sm:px-10 sm:pb-8">
          {isComplete ? (
            <>
              <form method="post" action={callbackAction}>
                <Button type="submit" className="w-full">
                  Sign in
                </Button>
              </form>
              <p className="text-center text-xs text-muted-foreground">
                This confirmation prevents automatic email scanners from using your sign-in link before you do.
              </p>
            </>
          ) : (
            <Button asChild className="w-full">
              <Link href="/login">Request a new link</Link>
            </Button>
          )}
        </CardContent>
      </Card>
    </main>
  );
}

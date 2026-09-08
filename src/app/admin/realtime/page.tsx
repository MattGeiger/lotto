// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Matt Geiger, Temple Consulting, LLC.

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Button } from "@/components/ui/button";
import { isRealtimeEligibleDeployment } from "@/lib/deployment-environment";

import RealtimeDiagnosticsClient from "./realtime-diagnostics-client";

export const metadata: Metadata = {
  title: "Realtime diagnostics",
  robots: { index: false, follow: false },
};

export default function RealtimeDiagnosticsPage() {
  if (!isRealtimeEligibleDeployment()) notFound();

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-6 px-4 py-8 sm:px-6">
      <div>
        <Button asChild variant="ghost" className="-ml-4">
          <Link href="/admin">Back to Admin</Link>
        </Button>
      </div>
      <RealtimeDiagnosticsClient />
    </main>
  );
}

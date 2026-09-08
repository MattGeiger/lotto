// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 Matt Geiger, Temple Consulting, LLC.

import { FlaskConical } from "lucide-react";

import { isBetaDeployment } from "@/lib/deployment-environment";

export function BetaEnvironmentBanner() {
  if (!isBetaDeployment()) return null;

  return (
    <aside
      aria-label="Beta test environment"
      className="w-full border border-status-warning-border bg-status-warning-bg px-4 py-2 text-status-warning-text shadow-sm"
    >
      <div className="mx-auto flex max-w-5xl items-center justify-center gap-2 text-center text-sm">
        <FlaskConical className="size-4 shrink-0" aria-hidden="true" />
        <p>
          <strong className="font-bold uppercase tracking-wide">Beta test environment</strong>
          <span className="ml-1.5">
            Data and actions here do not affect the production LOTTO app.
          </span>
        </p>
      </div>
    </aside>
  );
}

// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Matt Geiger, Temple Consulting, LLC.

"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, RefreshCw, Wrench } from "lucide-react";
import { toast } from "sonner";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type PublicationStatus = "pending" | "accepted" | "failed" | "superseded";

type LatestPublication = {
  publicationId: string;
  revision: number;
  status: PublicationStatus;
  attemptCount: number;
  committedAt: string;
  lastAttemptAt: string | null;
  acceptedAt: string | null;
  lastError: string | null;
  updatedAt: string;
};

type StatusResponse = {
  status?: {
    enabled: boolean;
    latest?: LatestPublication | null;
  };
  error?: { message?: string };
};

const formatTime = (value: string | null | undefined) => {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Unavailable" : date.toLocaleString();
};

export default function RealtimeDiagnosticsClient() {
  const [publication, setPublication] = useState<StatusResponse["status"] | null>(null);
  const [loading, setLoading] = useState(true);
  const [repairing, setRepairing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadStatus = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/state/realtime", { cache: "no-store" });
      const result = (await response.json()) as StatusResponse;
      if (!response.ok || !result.status) {
        throw new Error(result.error?.message ?? "Unable to load realtime status.");
      }
      setPublication(result.status);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load realtime status.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  const retryLatest = async () => {
    setRepairing(true);
    try {
      const response = await fetch("/api/state/realtime", { method: "POST" });
      const result = (await response.json()) as {
        repair?: { attempted?: boolean; accepted?: boolean };
        error?: { message?: string };
      };
      if (!response.ok) {
        throw new Error(result.error?.message ?? "Unable to retry publication.");
      }
      if (!result.repair?.attempted) {
        toast.info("No pending or failed publication needs repair.");
      } else if (result.repair.accepted) {
        toast.success("Latest realtime publication accepted.");
      } else {
        toast.error("The repair attempt was not accepted. Review the refreshed status.");
      }
      await loadStatus();
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "Unable to retry publication.");
    } finally {
      setRepairing(false);
    }
  };

  const latest = publication?.latest;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Realtime beta diagnostics</CardTitle>
        <CardDescription>
          Inspect the newest Neon shadow-publication record and retry only the newest pending or
          failed full state. This beta-only tool never changes the authoritative raffle state.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {error ? (
          <Alert variant="destructive">
            <AlertTitle>Status unavailable</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            Loading publication status…
          </div>
        ) : publication?.enabled === false ? (
          <Alert>
            <AlertTitle>Shadow publication disabled</AlertTitle>
            <AlertDescription>
              The beta app continues to use Neon normally. No hub publication will be attempted.
            </AlertDescription>
          </Alert>
        ) : latest ? (
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">Status</dt>
              <dd><Badge variant={latest.status === "accepted" ? "default" : "secondary"}>{latest.status}</Badge></dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Revision</dt>
              <dd className="font-mono">{latest.revision}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Attempts</dt>
              <dd>{latest.attemptCount}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Committed</dt>
              <dd>{formatTime(latest.committedAt)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Last attempt</dt>
              <dd>{formatTime(latest.lastAttemptAt)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Accepted</dt>
              <dd>{formatTime(latest.acceptedAt)}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-muted-foreground">Publication ID</dt>
              <dd className="break-all font-mono text-xs">{latest.publicationId}</dd>
            </div>
            {latest.lastError ? (
              <div className="sm:col-span-2">
                <dt className="text-muted-foreground">Last error</dt>
                <dd>{latest.lastError}</dd>
              </div>
            ) : null}
          </dl>
        ) : publication ? (
          <p className="text-sm text-muted-foreground">No publication evidence exists yet.</p>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={() => void loadStatus()} disabled={loading || repairing}>
            <RefreshCw className="size-4" aria-hidden="true" />
            Refresh status
          </Button>
          <Button type="button" onClick={() => void retryLatest()} disabled={loading || repairing || publication?.enabled !== true}>
            {repairing ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Wrench className="size-4" aria-hidden="true" />}
            Retry newest publication
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

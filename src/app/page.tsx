import Link from "next/link";
import { ArrowRight, Eye, Lock, QrCode } from "lucide-react";

import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-8 px-6 py-12">
      <div className="flex flex-col gap-6 rounded-3xl bg-white/80 p-10 shadow-xl backdrop-blur">
        <div className="flex flex-wrap items-center gap-3">
          <Badge>William Temple House</Badge>
          <Badge variant="muted">Digital Raffle</Badge>
        </div>
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
              Fair, simple queue management
            </h1>
            <p className="max-w-2xl text-base leading-relaxed text-slate-600">
              A lightweight Next.js app that replaces the coffee-can raffle with a durable,
              randomized, volunteer-friendly system. Manage ticket ranges, keep clients informed,
              and display the board on phones or a wall screen.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link href="/admin">
                Open Staff Dashboard <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="secondary" size="lg">
              <Link href="/display">
                View Public Board <Eye className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
        <Separator />
        <div className="grid gap-4 sm:grid-cols-2">
          <Card className="bg-gradient-to-br from-white to-blue-50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lock className="h-4 w-4 text-blue-600" />
                Volunteer-safe controls
              </CardTitle>
              <CardDescription>
                Confirm critical actions, restore previous state automatically, and keep writes
                atomic so no data is lost mid-shift.
              </CardDescription>
            </CardHeader>
          </Card>
          <Card className="bg-gradient-to-br from-white to-emerald-50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <QrCode className="h-4 w-4 text-emerald-600" />
                Client-friendly display
              </CardTitle>
              <CardDescription>
                QR code to the live /display board, mobile-friendly layout, and high-contrast
                “now serving” highlights to cut down on crowding.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </div>
    </main>
  );
}

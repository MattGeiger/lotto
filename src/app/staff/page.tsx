import Image from "next/image";
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
      <div className="flex flex-col gap-6 rounded-3xl bg-card/80 p-10 shadow-xl backdrop-blur">
        <div className="w-full">
          <Image
            src="/wth-logo-horizontal.png"
            alt="William Temple House"
            width={900}
            height={240}
            className="h-auto w-full max-w-3xl"
            priority
          />
        </div>
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              Fair, simple queue management
            </h1>
            <p className="max-w-2xl text-base leading-relaxed text-muted-foreground">
              A lightweight Next.js app that replaces the coffee-can raffle with a durable,
              randomized, volunteer-friendly system. Manage ticket ranges, keep clients informed,
              and display the board on phones or a wall screen.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link href="/admin">
                Open Staff Dashboard <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button asChild variant="secondary" size="lg">
              <Link href="/">
                View Public Board <Eye className="size-4" />
              </Link>
            </Button>
          </div>
        </div>
        <Separator />
        <div className="grid gap-4 sm:grid-cols-2">
          <Card className="bg-gradient-card-info">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-card-title">
                <Lock className="size-4 text-card-icon" />
                Error-safe controls
              </CardTitle>
              <CardDescription>
                Confirm critical actions, restore previous states, and keep writes
                atomic so no data is lost.
              </CardDescription>
            </CardHeader>
          </Card>
          <Card className="bg-gradient-card-accent">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-card-title">
                <QrCode className="size-4 text-card-icon" />
                Client-friendly display
              </CardTitle>
            <CardDescription>
              Mobile-friendly access, with QR code linking to the live board and ticket number lookup for estimated wait times
            </CardDescription>
          </CardHeader>
          </Card>
        </div>
      </div>
    </main>
  );
}

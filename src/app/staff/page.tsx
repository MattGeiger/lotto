// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 Matt Geiger, Temple Consulting, LLC.
//
// LOTTO — Line Order Transparency & Ticketing Organizer. Application code
// licensed under AGPL-3.0-or-later; see LICENSE. William Temple House branding
// is not covered by this license; see TRADEMARKS.md.

import { redirect } from "next/navigation";

import { version } from "../../../package.json";
import { BetaEnvironmentBanner } from "@/components/beta-environment-banner";
import { LoginExperience } from "@/components/login-experience";
import { StaffLinksFooter } from "@/components/staff-links-footer";
import { auth } from "@/lib/auth";
import { readReleaseNotes } from "@/lib/release-notes";

export const metadata = {
  title: "Staff sign in",
};

// `/staff` is the staff front door: a sign-in screen. Already-authenticated
// visitors are sent straight to the dashboard. (The former marketing landing was
// retired in v2.0.)
export default async function StaffPage() {
  const session = await auth();
  if (session) {
    redirect("/admin");
  }

  const releaseNotes = readReleaseNotes();
  return (
    <LoginExperience
      banner={<BetaEnvironmentBanner />}
      footer={<StaffLinksFooter version={version} releaseNotes={releaseNotes} />}
    />
  );
}

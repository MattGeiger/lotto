// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 Matt Geiger, Temple Consulting, LLC.
//
// LOTTO — Line Order Transparency & Ticketing Organizer. Application code
// licensed under AGPL-3.0-or-later; see LICENSE. William Temple House branding
// is not covered by this license; see TRADEMARKS.md.

import { version } from "../../../package.json";
import { BetaEnvironmentBanner } from "@/components/beta-environment-banner";
import { LoginExperience } from "@/components/login-experience";
import { StaffLinksFooter } from "@/components/staff-links-footer";
import { readReleaseNotes } from "@/lib/release-notes";

export const metadata = {
  title: "Sign in",
};

export default function LoginPage() {
  const releaseNotes = readReleaseNotes();
  return (
    <LoginExperience
      banner={<BetaEnvironmentBanner />}
      footer={<StaffLinksFooter version={version} releaseNotes={releaseNotes} />}
    />
  );
}

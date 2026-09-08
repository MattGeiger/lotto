// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 Matt Geiger, Temple Consulting, LLC.
//
// LOTTO — Line Order Transparency & Ticketing Organizer. Application code
// licensed under AGPL-3.0-or-later; see LICENSE. William Temple House branding
// is not covered by this license; see TRADEMARKS.md.

import { PersonalizedHomePage } from "@/components/personalized-home-page";
import {
  resolveRealtimeCanaryClientConfig,
  resolveRealtimeSourceClientConfig,
} from "@/lib/realtime/client-canary-config";

export default function HomePage() {
  return (
    <PersonalizedHomePage
      realtimeCanary={resolveRealtimeCanaryClientConfig()}
      realtimeSourceCanary={resolveRealtimeSourceClientConfig()}
    />
  );
}

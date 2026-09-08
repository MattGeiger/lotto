// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 Matt Geiger, Temple Consulting, LLC.
//
// LOTTO — Line Order Transparency & Ticketing Organizer. Application code
// licensed under AGPL-3.0-or-later; see LICENSE. William Temple House branding
// is not covered by this license; see TRADEMARKS.md.

import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PublicInventoryPage } from "@/components/public-inventory-page";
import { getResolvedBrand } from "@/lib/brand-config/resolve";
import {
  resolveRealtimeCanaryClientConfig,
  resolveRealtimeSourceClientConfig,
} from "@/lib/realtime/client-canary-config";

export async function generateMetadata(): Promise<Metadata> {
  const brand = await getResolvedBrand();
  return {
    title: "What's in Stock",
    description: brand.metadata.inventoryDescription,
  };
}

export default async function InventoryPage() {
  const brand = await getResolvedBrand();
  if (!brand.inventory.enabled) notFound();
  return (
    <PublicInventoryPage
      realtimeCanary={resolveRealtimeCanaryClientConfig()}
      realtimeSourceCanary={resolveRealtimeSourceClientConfig()}
    />
  );
}

// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 Matt Geiger, Temple Consulting, LLC.
//
// LOTTO — Line Order Transparency & Ticketing Organizer. Application code
// licensed under AGPL-3.0-or-later; see LICENSE. William Temple House branding
// is not covered by this license; see TRADEMARKS.md.

import type { Metadata } from "next";
import React from "react";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { getResolvedBrand } from "@/lib/brand-config/resolve";
import { BetaEnvironmentBanner } from "@/components/beta-environment-banner";

export async function generateMetadata(): Promise<Metadata> {
  const brand = await getResolvedBrand();
  return {
    title: "Admin",
    description: brand.metadata.adminDescription,
  };
}

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const isLocalDevelopment = process.env.NODE_ENV === "development" && !process.env.VERCEL;
  const authBypass = process.env.AUTH_BYPASS === "true" || isLocalDevelopment;

  if (authBypass) {
    return (
      <>
        <BetaEnvironmentBanner />
        {children}
      </>
    );
  }

  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  return (
    <>
      <BetaEnvironmentBanner />
      {children}
    </>
  );
}

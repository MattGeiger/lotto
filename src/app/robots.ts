// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 Matt Geiger, Temple Consulting, LLC.

import type { MetadataRoute } from "next";

import { isBetaDeployment } from "@/lib/deployment-environment";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      ...(isBetaDeployment() ? { disallow: "/" } : { allow: "/" }),
    },
  };
}

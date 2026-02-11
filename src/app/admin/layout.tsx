import React from "react";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const isLocalDevelopment = process.env.NODE_ENV === "development" && !process.env.VERCEL;
  const authBypass = process.env.AUTH_BYPASS === "true" || isLocalDevelopment;

  if (authBypass) {
    return <>{children}</>;
  }

  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  return <>{children}</>;
}

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";

export const config = {
  matcher: ["/admin/:path*", "/api/state", "/api/state/:path*"],
};

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isAdmin = pathname.startsWith("/admin");
  const isApiState = pathname.startsWith("/api/state");
  const isWriteApi =
    isApiState && !["GET", "HEAD", "OPTIONS"].includes(request.method.toUpperCase());
  const isLocalDevelopment = process.env.NODE_ENV === "development" && !process.env.VERCEL;
  const authBypass = process.env.AUTH_BYPASS === "true" || isLocalDevelopment;

  if (process.env.AUTH_BYPASS === "true" && process.env.NODE_ENV === "production") {
    throw new Error(
      "AUTH_BYPASS must not be enabled in production. Remove AUTH_BYPASS from your environment variables.",
    );
  }

  if ((isAdmin || isWriteApi) && !authBypass) {
    const session = await auth();
    if (!session) {
      if (pathname.startsWith("/api/")) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("callbackUrl", request.url);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

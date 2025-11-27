import NextAuth from "next-auth";
import type { NextAuthConfig } from "next-auth";
import PostgresAdapter from "@auth/pg-adapter";
import { Pool } from "@neondatabase/serverless";
import CredentialsProvider from "next-auth/providers/credentials";
import EmailProvider from "next-auth/providers/email";
import ResendProvider from "next-auth/providers/resend";
import { createHash } from "node:crypto";

const allowedDomain = process.env.ADMIN_EMAIL_DOMAIN?.toLowerCase();
const fromAddress = process.env.EMAIL_FROM ?? "login@localhost";
const resendApiKey = process.env.RESEND_API_KEY;

const emailServer = {
  host: process.env.EMAIL_SERVER_HOST ?? "localhost",
  port: Number(process.env.EMAIL_SERVER_PORT ?? "1025"),
  auth: process.env.EMAIL_SERVER_USER
    ? {
        user: process.env.EMAIL_SERVER_USER,
        pass: process.env.EMAIL_SERVER_PASSWORD ?? "",
      }
    : undefined,
} as const;

export const { handlers: authHandlers, auth } = NextAuth(() => {
  const bypassAuth = process.env.AUTH_BYPASS === "true";
  const isProduction = process.env.NODE_ENV === "production";
  const databaseUrl = process.env.DATABASE_URL;
  const useResend = Boolean(resendApiKey);

  if (!databaseUrl) {
    throw new Error(
      isProduction
        ? "DATABASE_URL is required for authentication in production. Set this to your Neon connection string."
        : "DATABASE_URL is required for NextAuth email login. Set this to your local Postgres connection string.",
    );
  }

  if (isProduction && (!fromAddress || !useResend)) {
    throw new Error(
      "Production requires RESEND_API_KEY and EMAIL_FROM for magic link delivery. Configure these env vars.",
    );
  }

  if (!useResend) {
    console.warn("[Auth] RESEND_API_KEY not set; falling back to SMTP/MailDev configuration.");
  }

  const pool = new Pool({
    connectionString: databaseUrl,
    connectionTimeoutMillis: 5000,
  });
  const hashToken = (value: string) => createHash("sha256").update(value).digest("hex");

  const adapter = PostgresAdapter(pool);

  console.log("[Auth] Adapter initialized successfully");

  const config: NextAuthConfig = {
    adapter,
    providers: [
      ...(useResend
        ? [
            ResendProvider({
              from: fromAddress,
              apiKey: resendApiKey,
            }),
          ]
        : [
            EmailProvider({
              from: fromAddress,
              server: emailServer,
            }),
          ]),
      CredentialsProvider({
        id: "otp",
        name: "One-Time Passcode",
        credentials: {
          email: { label: "Email", type: "email" },
          code: { label: "Code", type: "text" },
        },
        async authorize(credentials) {
          const email = credentials?.email?.toLowerCase();
          const code = credentials?.code?.trim();
          if (!email || !code) {
            throw new Error("Email and code are required.");
          }
          if (allowedDomain && !email.endsWith(`@${allowedDomain}`)) {
            throw new Error("Email domain is not allowed.");
          }
          const hashed = hashToken(code);
          const result = await pool.query(
            "delete from verification_token where identifier = $1 and token = $2 and expires > now() returning identifier",
            [email, hashed],
          );
          if (result.rowCount === 0) {
            throw new Error("Invalid or expired code.");
          }
          return { id: email, email };
        },
      }),
    ],
    pages: {
      signIn: "/login",
      verifyRequest: "/login",
      error: "/login",
    },
    callbacks: {
      async signIn({ user }) {
        if (bypassAuth) {
          console.log("[Auth] signIn bypass");
          return true;
        }
        console.log("[Auth] signIn callback", { email: user.email });
        const email = user.email?.toLowerCase();
        if (allowedDomain && email && email.endsWith(`@${allowedDomain}`)) {
          console.log("[Auth] signIn approved");
          return true;
        }
        console.log("[Auth] signIn rejected - domain mismatch");
        return false;
      },
    },
    session: { strategy: "jwt" },
    trustHost: true,
    debug: process.env.NODE_ENV === "development",
  };

  return config;
});

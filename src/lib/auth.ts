import NextAuth from "next-auth";
import type { NextAuthConfig } from "next-auth";
import PostgresAdapter from "@auth/pg-adapter";
import { Pool } from "@neondatabase/serverless";
import EmailProvider from "next-auth/providers/email";
import { Resend } from "resend";

const allowedDomain = process.env.ADMIN_EMAIL_DOMAIN?.toLowerCase();
const fromAddress = process.env.EMAIL_FROM ?? "noreply@example.com";
const resendApiKey = process.env.RESEND_API_KEY;

const resend = resendApiKey ? new Resend(resendApiKey) : null;
const emailServer =
  process.env.EMAIL_SERVER ??
  ({
    host: "localhost",
    port: 1025,
    auth: { user: "user", pass: "pass" },
  } as const);

export const { handlers: authHandlers, auth } = NextAuth(() => {
  const useDatabase = process.env.USE_DATABASE !== "false";
  const dbSources = [
    ["POSTGRES_PRISMA_URL", process.env.POSTGRES_PRISMA_URL],
    ["POSTGRES_URL", process.env.POSTGRES_URL],
    ["POSTGRES_URL_NON_POOLING", process.env.POSTGRES_URL_NON_POOLING],
    ["POSTGRES_URL_NON_POOLING_NO_TLS", process.env.POSTGRES_URL_NON_POOLING_NO_TLS],
    ["POSTGRES_URL_NO_SSL", process.env.POSTGRES_URL_NO_SSL],
    ["POSTGRES_DATABASE_URL_UNPOOLED", process.env.POSTGRES_DATABASE_URL_UNPOOLED],
    ["POSTGRES_DATABASE_URL", process.env.POSTGRES_DATABASE_URL],
    ["DATABASE_URL", process.env.DATABASE_URL],
  ] as const;
  const picked = dbSources.find(([, value]) => Boolean(value));
  const databaseUrl = picked?.[1];

  console.log("[Auth] Initializing with:", {
    useDatabase,
    hasDbUrl: !!databaseUrl,
    dbSource: picked?.[0] ?? "none",
    hasResendKey: !!resendApiKey,
    fromAddress,
  });

  const adapter =
    databaseUrl && useDatabase ? PostgresAdapter(new Pool({ connectionString: databaseUrl })) : undefined;

  if (!adapter) {
    console.error("[Auth] No database adapter configured!", {
      useDatabase,
      hasDbUrl: !!databaseUrl,
      pickedSource: picked?.[0] ?? null,
    });
  } else {
    console.log("[Auth] Adapter initialized successfully");
  }

  const config: NextAuthConfig = {
    adapter,
    providers: [
      EmailProvider({
        from: fromAddress,
        server: emailServer,
        sendVerificationRequest: async ({ identifier, url, provider }) => {
          console.log("[Auth] sendVerificationRequest START", {
            identifier,
            hasResend: !!resend,
            fromAddress,
            hasResendApiKey: !!resendApiKey,
          });

          const email = identifier.toLowerCase();
          if (!fromAddress || !resend) {
            throw new Error("Email auth is not configured. Set EMAIL_FROM and RESEND_API_KEY.");
          }
          if (allowedDomain && !email.endsWith(`@${allowedDomain}`)) {
            throw new Error("Email domain is not allowed.");
          }

          try {
            console.log("[Auth] Sending email via Resend...", { to: email });
            const { error } = await resend.emails.send({
              from: fromAddress,
              to: [email],
              subject: "Your William Temple House login link",
              html: `
                <p>Click the link below to sign in:</p>
                <p><a href="${url}">${url}</a></p>
                <p>This link will expire shortly. If you did not request it, you can ignore this email.</p>
              `,
            });

            if (error) {
              console.error("[Auth] Resend API error:", { error, to: email, from: fromAddress });
              throw new Error(
                provider?.type === "email"
                  ? `Unable to send verification email: ${String(error)}`
                  : "Unable to send verification email.",
              );
            }
            console.log("[Auth] Email sent successfully!", { to: email });
          } catch (err) {
            console.error("[Auth] sendVerificationRequest FAILED:", { err, to: email, from: fromAddress });
            throw err;
          }
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
    trustHost:
      process.env.AUTH_TRUST_HOST === "true" ||
      process.env.NODE_ENV !== "production" ||
      (process.env.AUTH_URL ?? process.env.NEXTAUTH_URL ?? "").includes("localhost"),
    debug: true,
  };

  return config;
});

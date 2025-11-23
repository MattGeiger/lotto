import NextAuth, { type NextAuthConfig } from "next-auth";
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

export const authOptions: NextAuthConfig = {
  providers: [
    EmailProvider({
      from: fromAddress,
      server: emailServer,
      sendVerificationRequest: async ({ identifier, url, provider }) => {
        const email = identifier.toLowerCase();
        if (!fromAddress || !resend) {
          throw new Error("Email auth is not configured. Set EMAIL_FROM and RESEND_API_KEY.");
        }
        if (allowedDomain && !email.endsWith(`@${allowedDomain}`)) {
          throw new Error("Email domain is not allowed.");
        }

        try {
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
            console.error("Magic link send failed", { error, to: email, from: fromAddress });
            throw new Error(
              provider?.type === "email"
                ? `Unable to send verification email: ${String(error)}`
                : "Unable to send verification email.",
            );
          }
        } catch (err) {
          console.error("Magic link send threw", { err, to: email, from: fromAddress });
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
      const email = user.email?.toLowerCase();
      if (allowedDomain && email && email.endsWith(`@${allowedDomain}`)) {
        return true;
      }
      return false;
    },
  },
  session: { strategy: "jwt" },
  trustHost: process.env.AUTH_TRUST_HOST === "true" || process.env.NODE_ENV !== "production",
};

export const { handlers: authHandlers, auth } = NextAuth(authOptions);

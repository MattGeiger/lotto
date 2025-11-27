import { createHash, randomInt } from "node:crypto";

import { NextResponse } from "next/server";
import { Resend } from "resend";
import { z } from "zod";
import nodemailer from "nodemailer";
import { render } from "@react-email/components";

import { getPool } from "@/lib/db";
import { OtpCode } from "@/emails/otp-code";

export const runtime = "nodejs";

const requestSchema = z.object({
  email: z.string().email(),
});

const hashToken = (value: string) => createHash("sha256").update(value).digest("hex");
const generateCode = () => String(randomInt(100000, 1000000));

export async function POST(request: Request) {
  const pool = getPool();
  try {
    const ensureOtpFailuresTable = async () => {
      await pool.query(`
        create table if not exists otp_failures (
          email text primary key,
          attempts int not null default 0,
          locked_until timestamptz,
          last_request timestamptz
        );
      `);
    };

    const body = await request.json().catch(() => ({}));
    const parsed = requestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid email." }, { status: 400 });
    }

    const email = parsed.data.email.toLowerCase();
    const allowedDomain = process.env.ADMIN_EMAIL_DOMAIN?.toLowerCase();
    if (allowedDomain && !email.endsWith(`@${allowedDomain}`)) {
      return NextResponse.json({ error: "Email domain is not allowed." }, { status: 403 });
    }

    const fromAddress = process.env.EMAIL_FROM ?? "login@localhost";
    const resendApiKey = process.env.RESEND_API_KEY;
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
    const code = generateCode();
    const token = hashToken(code);

    await ensureOtpFailuresTable();
    const now = new Date();
    const failureRow = await pool.query<{ locked_until: string | null; last_request: string | null }>(
      "select locked_until, last_request from otp_failures where email = $1 limit 1",
      [email],
    );
    const lockedUntil = failureRow.rows[0]?.locked_until
      ? new Date(failureRow.rows[0].locked_until)
      : null;
    if (lockedUntil && lockedUntil > now) {
      return NextResponse.json(
        { error: "Too many attempts. Try again after cooldown." },
        { status: 429 },
      );
    }
    const lastRequest = failureRow.rows[0]?.last_request
      ? new Date(failureRow.rows[0].last_request)
      : null;
    if (lastRequest && now.getTime() - lastRequest.getTime() < 60_000) {
      return NextResponse.json(
        { error: "Please wait before requesting another code." },
        { status: 429 },
      );
    }

    await pool.query("delete from verification_token where identifier = $1", [email]);
    await pool.query(
      "insert into verification_token (identifier, token, expires) values ($1, $2, $3)",
      [email, token, expiresAt.toISOString()],
    );
    await pool.query(
      `
        insert into otp_failures (email, attempts, locked_until, last_request)
        values ($1, 0, null, $2)
        on conflict (email) do update
        set attempts = 0, locked_until = null, last_request = $2
      `,
      [email, now.toISOString()],
    );

    const htmlContent = await render(<OtpCode code={code} />);

    if (resendApiKey) {
      const resend = new Resend(resendApiKey);
      const { error } = await resend.emails.send({
        from: fromAddress,
        to: [email],
        subject: "Your William Temple House login code",
        html: htmlContent,
      });
      if (error) {
        console.error("[OTP] Resend error:", error);
        return NextResponse.json(
          { error: "Unable to send code. Please try again." },
          { status: 500 },
        );
      }
    } else {
      const transporter = nodemailer.createTransport({
        host: process.env.EMAIL_SERVER_HOST ?? "localhost",
        port: Number(process.env.EMAIL_SERVER_PORT ?? "1025"),
        secure: false,
        auth: process.env.EMAIL_SERVER_USER
          ? {
              user: process.env.EMAIL_SERVER_USER,
              pass: process.env.EMAIL_SERVER_PASSWORD ?? "",
            }
          : undefined,
      });
      await transporter.sendMail({
        from: fromAddress,
        to: email,
        subject: "Your William Temple House login code",
        html: htmlContent,
      });
    }

    console.log("[OTP] Code issued", { email });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[OTP] Failed to issue code:", error);
    return NextResponse.json(
      { error: "Unable to issue code. Please try again." },
      { status: 500 },
    );
  }
}

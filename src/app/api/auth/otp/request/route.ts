import { createHash, randomInt } from "node:crypto";

import { Pool } from "@neondatabase/serverless";
import { NextResponse } from "next/server";
import { Resend } from "resend";
import { z } from "zod";
import nodemailer from "nodemailer";

export const runtime = "nodejs";

const requestSchema = z.object({
  email: z.string().email(),
});

const hashToken = (value: string) => createHash("sha256").update(value).digest("hex");
const generateCode = () => String(randomInt(100000, 1000000));

export async function POST(request: Request) {
  try {
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

    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      return NextResponse.json({ error: "DATABASE_URL is not configured." }, { status: 500 });
    }

    const fromAddress = process.env.EMAIL_FROM ?? "login@localhost";
    const resendApiKey = process.env.RESEND_API_KEY;
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
    const code = generateCode();
    const token = hashToken(code);

    const pool = new Pool({
      connectionString: databaseUrl,
      connectionTimeoutMillis: 5000,
    });

    await pool.query("delete from verification_token where identifier = $1", [email]);
    await pool.query(
      "insert into verification_token (identifier, token, expires) values ($1, $2, $3)",
      [email, token, expiresAt.toISOString()],
    );

    if (resendApiKey) {
      const resend = new Resend(resendApiKey);
      const { error } = await resend.emails.send({
        from: fromAddress,
        to: [email],
        subject: "Your William Temple House login code",
        html: `
          <p>Use this one-time code to sign in:</p>
          <p style="font-size: 24px; font-weight: bold; letter-spacing: 2px;">${code}</p>
          <p>This code expires in 10 minutes. If you did not request it, you can ignore this email.</p>
        `,
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
        html: `
          <p>Use this one-time code to sign in:</p>
          <p style="font-size: 24px; font-weight: bold; letter-spacing: 2px;">${code}</p>
          <p>This code expires in 10 minutes. If you did not request it, you can ignore this email.</p>
        `,
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

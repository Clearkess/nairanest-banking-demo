import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "@/lib/db";
import { createSession, isSameOrigin } from "@/lib/auth";
export const runtime = "nodejs";
const schema = z.object({
  fullName: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(254),
  password: z.string().min(12).max(128).regex(/[a-z]/).regex(/[A-Z]/).regex(/[0-9]/),
  phone: z.string().trim().min(7).max(20).optional()
});
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Enter valid details. Passwords must be at least 12 characters and include uppercase, lowercase and a number." }, { status: 400 });
  const email = parsed.data.email.toLowerCase();
  const existing = await db.user.findUnique({ where: { email }, select: { id: true } });
  if (existing) return NextResponse.json({ error: "Unable to create account with those details." }, { status: 409 });
  const passwordHash = await bcrypt.hash(parsed.data.password, 12);
  const user = await db.user.create({
    data: {
      email, fullName: parsed.data.fullName, passwordHash, phone: parsed.data.phone,
      accounts: { create: { internalReference: "NN-" + randomBytes(8).toString("hex").toUpperCase(), currency: "NGN", status: "PENDING" } }
    },
    select: { id: true, email: true, fullName: true, status: true, kycStatus: true }
  });
  await createSession(user.id);
  return NextResponse.json({ user, message: "Registration received. Identity verification and account approval are required before banking features are enabled." }, { status: 201 });
}

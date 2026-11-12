import { createHash, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getSessionUser, isSameOrigin } from "@/lib/auth";
export const runtime = "nodejs";
const schema = z.object({
  fromAccountId: z.string().min(1),
  toAccountReference: z.string().min(5).max(40),
  amountMinor: z.number().int().positive().max(100_000_000),
  description: z.string().trim().min(2).max(100)
});
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (user.status !== "ACTIVE" || user.kycStatus !== "VERIFIED") return NextResponse.json({ error: "Identity verification and account approval are required before transfers." }, { status: 403 });
  const key = request.headers.get("idempotency-key");
  if (!key || key.length < 16 || key.length > 128) return NextResponse.json({ error: "A valid Idempotency-Key header is required." }, { status: 400 });
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid transfer details." }, { status: 400 });
  const { fromAccountId, toAccountReference, amountMinor, description } = parsed.data;
  const fingerprint = createHash("sha256").update(JSON.stringify({ userId: user.id, fromAccountId, toAccountReference, amountMinor, description })).digest("hex");
  try {
    const result = await db.$transaction(async (tx) => {
      const prior = await tx.ledgerTransaction.findUnique({ where: { idempotencyKey: key } });
      if (prior) {
        if (prior.requestFingerprint !== fingerprint) throw new Error("IDEMPOTENCY_CONFLICT");
        return { reference: prior.reference, status: prior.status, duplicate: true };
      }
      const [source, destination] = await Promise.all([
        tx.account.findFirst({ where: { id: fromAccountId, userId: user.id, status: "ACTIVE" } }),
        tx.account.findUnique({ where: { internalReference: toAccountReference }, include: { user: true } })
      ]);
      if (!source || !destination || destination.status !== "ACTIVE" || destination.user.status !== "ACTIVE" || destination.user.kycStatus !== "VERIFIED" || source.currency !== destination.currency || source.id === destination.id) throw new Error("ACCOUNT_UNAVAILABLE");
      const [debits, credits] = await Promise.all([
        tx.ledgerEntry.aggregate({ where: { accountId: source.id, side: "DEBIT" }, _sum: { amountMinor: true } }),
        tx.ledgerEntry.aggregate({ where: { accountId: source.id, side: "CREDIT" }, _sum: { amountMinor: true } })
      ]);
      const available = (credits._sum.amountMinor ?? 0n) - (debits._sum.amountMinor ?? 0n);
      if (available < BigInt(amountMinor)) throw new Error("INSUFFICIENT_FUNDS");
      const reference = "NNT-" + randomBytes(10).toString("hex").toUpperCase();
      const transaction = await tx.ledgerTransaction.create({
        data: {
          reference, idempotencyKey: key, requestFingerprint: fingerprint, status: "POSTED",
          description, currency: source.currency, postedAt: new Date(),
          entries: { create: [
            { accountId: source.id, side: "DEBIT", amountMinor: BigInt(amountMinor) },
            { accountId: destination.id, side: "CREDIT", amountMinor: BigInt(amountMinor) }
          ] }
        }
      });
      return { reference: transaction.reference, status: transaction.status, duplicate: false };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    return NextResponse.json(result, { status: result.duplicate ? 200 : 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "IDEMPOTENCY_CONFLICT") return NextResponse.json({ error: "This idempotency key was already used for a different request." }, { status: 409 });
    if (message === "ACCOUNT_UNAVAILABLE") return NextResponse.json({ error: "The selected accounts are unavailable for this transfer." }, { status: 400 });
    if (message === "INSUFFICIENT_FUNDS") return NextResponse.json({ error: "Insufficient available funds." }, { status: 409 });
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") return NextResponse.json({ error: "Transfer conflict. Please retry with the same idempotency key." }, { status: 409 });
    return NextResponse.json({ error: "Transfer could not be completed." }, { status: 500 });
  }
}

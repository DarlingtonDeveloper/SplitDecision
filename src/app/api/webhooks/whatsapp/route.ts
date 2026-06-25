import { NextRequest, NextResponse } from "next/server";
import { createHmac } from "crypto";
import { normalizeInbound } from "@/lib/whatsapp";
import { isDuplicateMessagePersistent } from "@/lib/idempotency";
import { handleWhatsAppCommand } from "@/lib/agent/command-handler";

export const runtime = "nodejs";

function verifySignature(rawBody: string, signature: string | null): boolean {
  const secret = process.env.WASSIST_SIGNING_SECRET;
  if (!secret) return true; // skip if not configured
  if (!signature) return false;

  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  return signature === expected;
}

export async function POST(req: NextRequest) {
  let rawBody: string;
  let payload: unknown;
  try {
    rawBody = await req.text();
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ ok: true });
  }

  if (!verifySignature(rawBody, req.headers.get("x-wassist-signature"))) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  const msg = normalizeInbound(payload);
  if (!msg) {
    return NextResponse.json({ ok: true, skipped: "unrecognised payload" });
  }

  if (await isDuplicateMessagePersistent(msg.message_id)) {
    return NextResponse.json({ ok: true, deduped: true });
  }

  // Process async — return 200 immediately so Wassist doesn't retry
  void handleWhatsAppCommand(msg.from, msg.body).catch((err) => {
    console.error("[whatsapp webhook]", err);
  });

  return NextResponse.json({ ok: true });
}

import { NextRequest, NextResponse } from "next/server";
import { normalizeInbound } from "@/lib/whatsapp";
import { isDuplicateMessagePersistent } from "@/lib/idempotency";
import { handleWhatsAppCommand } from "@/lib/agent/command-handler";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ ok: true });
  }

  const msg = normalizeInbound(payload);
  if (!msg) {
    return NextResponse.json({ ok: true, skipped: "unrecognised payload" });
  }

  if (await isDuplicateMessagePersistent(msg.message_id)) {
    return NextResponse.json({ ok: true, deduped: true });
  }

  // Process async — return 200 immediately
  void handleWhatsAppCommand(msg.from, msg.body).catch((err) => {
    console.error("[whatsapp webhook]", err);
  });

  return NextResponse.json({ ok: true });
}

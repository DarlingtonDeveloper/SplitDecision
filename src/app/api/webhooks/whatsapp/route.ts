import { NextRequest, NextResponse } from "next/server";
import { createHmac } from "crypto";
import { normalizeInbound, sendText } from "@/lib/whatsapp";
import { isDuplicateMessagePersistent } from "@/lib/idempotency";
import { handleWhatsAppCommand } from "@/lib/agent/command-handler";
import { processBrief } from "@/lib/agent/pipeline";
import { logAction } from "@/lib/actions";

export const runtime = "nodejs";
export const maxDuration = 60;

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

  // Determine if this is the producer (command) or an external contact (brief)
  const producerConvId = process.env.WASSIST_PRODUCER_CONVERSATION_ID;
  const isProducer = msg.conversationId === producerConvId;

  // Process async — return 200 immediately so Wassist doesn't retry
  void (async () => {
    try {
      if (isProducer) {
        await handleWhatsAppCommand(msg.from, msg.body);
      } else {
        // External message — treat as inbound brief
        await logAction({
          pillar: "negotiation",
          trigger: "whatsapp_inbound",
          action_taken: `WhatsApp brief from ${msg.from}: "${msg.body.slice(0, 80)}"`,
          channel: "whatsapp",
        });

        // Acknowledge to the sender
        try {
          await sendText(msg.conversationId, "Thanks! I've passed this to the producer. You'll hear back shortly.");
        } catch { /* best effort */ }

        // Process as a brief
        await processBrief({
          source: "whatsapp",
          from_contact: msg.from,
          raw_text: msg.body,
        });
      }
    } catch (err) {
      console.error("[whatsapp webhook]", err);
    }
  })();

  return NextResponse.json({ ok: true });
}

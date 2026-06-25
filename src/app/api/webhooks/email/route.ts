import { NextRequest, NextResponse } from "next/server";
import { classifyEmail } from "@/lib/agent/email-classifier";
import { processBrief, processNegotiationEmail } from "@/lib/agent/pipeline";
import { logAction } from "@/lib/actions";

export const runtime = "nodejs";

/**
 * POST /api/webhooks/email
 * Inbound email webhook (e.g. from a forwarding service or manual post).
 * Classifies automatically — no need to pass `kind`.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const from = (body.from ?? body.sender ?? "unknown") as string;
  const subject = (body.subject ?? "Inbound") as string;
  const text = (body.body ?? body.text ?? body.raw_text ?? "") as string;

  void (async () => {
    try {
      const classified = await classifyEmail({ from, subject, body: text });

      await logAction({
        pillar: "negotiation",
        trigger: "email_webhook",
        action_taken: `Email classified as ${classified.kind} from ${from}`,
        channel: "email",
      });

      const emailAddr = from.match(/<([^>]+)>/)?.[1] ?? from;

      if (classified.kind === "negotiation_reply") {
        await processNegotiationEmail({ from: emailAddr, subject, body: text });
      } else if (classified.kind === "new_brief") {
        await processBrief({
          source: "email",
          from_contact: from,
          raw_text: text,
          to_address: body.to_address ?? emailAddr,
        });
      } else {
        await logAction({
          trigger: "email_webhook",
          action_taken: `Skipped email (kind: other): "${subject}"`,
          channel: "email",
        });
      }
    } catch (err) {
      console.error("[email webhook]", err);
    }
  })();

  return NextResponse.json({ ok: true });
}

import { NextRequest, NextResponse } from "next/server";
import { processBrief, processNegotiationEmail } from "@/lib/agent/pipeline";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const from = (body.from ?? body.sender ?? "unknown") as string;
  const subject = (body.subject ?? "Inbound") as string;
  const text = (body.body ?? body.text ?? body.raw_text ?? "") as string;
  const kind = (body.kind ?? "brief") as "brief" | "negotiation";

  void (async () => {
    try {
      if (kind === "negotiation") {
        await processNegotiationEmail({ from, subject, body: text });
      } else {
        await processBrief({
          source: "email",
          from_contact: from,
          raw_text: text,
          to_address: body.to_address,
        });
      }
    } catch (err) {
      console.error("[email webhook]", err);
    }
  })();

  return NextResponse.json({ ok: true });
}

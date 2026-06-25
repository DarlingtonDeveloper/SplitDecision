import { NextRequest, NextResponse } from "next/server";
import { classifyEmail } from "@/lib/agent/email-classifier";
import { processBrief, processNegotiationEmail } from "@/lib/agent/pipeline";
import { logAction } from "@/lib/actions";

export const runtime = "nodejs";

const DEMO_BRIEF = {
  from: "Sable <sable@polydor.com>",
  subject: "Beat brief — developing artist",
  body: `Hi,

Need something dark, Utopia-era Travis Scott vibe, around 140 BPM, minor key.
For a developing artist on the roster — non-exclusive lease budget ~£500.
References: dark trap, atmospheric, spacey pads.

Let me know what you've got.

Sable
A&R, Polydor`,
};

const DEMO_NEGOTIATION = {
  from: "James Carter <james@atlanticrecords.com>",
  subject: "Re: Midnight — placement terms",
  body: `Thanks for sending over that beat. We'd like to use "Midnight" for our artist's upcoming project.

Our standard terms: 60/40 publishing split (our favour), 2 points on the master, no upfront fee.
Non-exclusive lease for 12 months, UK territory only.

Let me know if that works.

James`,
};

/**
 * POST /api/email/seed
 * Demo safety route — paste a raw email or use a built-in demo.
 * Same classify→route path as live inbound, so it's honest.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));

  const preset = body.preset as string | undefined; // "brief" or "negotiation"
  const from = (body.from ?? (preset === "negotiation" ? DEMO_NEGOTIATION.from : DEMO_BRIEF.from)) as string;
  const subject = (body.subject ?? (preset === "negotiation" ? DEMO_NEGOTIATION.subject : DEMO_BRIEF.subject)) as string;
  const text = (body.body ?? body.text ?? (preset === "negotiation" ? DEMO_NEGOTIATION.body : DEMO_BRIEF.body)) as string;

  // Run async, return immediately
  void (async () => {
    try {
      await logAction({
        pillar: "negotiation",
        trigger: "email_seed",
        action_taken: `Seeded email from ${from}: "${subject}"`,
        channel: "email",
      });

      const classified = await classifyEmail({ from, subject, body: text });

      await logAction({
        pillar: "negotiation",
        trigger: "email_classifier",
        action_taken: `Classified seeded email as ${classified.kind} (${classified.from_role})`,
        channel: "internal",
      });

      const emailAddr = from.match(/<([^>]+)>/)?.[1] ?? from;

      if (classified.kind === "negotiation_reply") {
        await processNegotiationEmail({ from: emailAddr, subject, body: text });
      } else {
        await processBrief({
          source: "email",
          from_contact: from,
          raw_text: text,
          to_address: emailAddr,
        });
      }
    } catch (err) {
      console.error("[email/seed]", err);
    }
  })();

  return NextResponse.json({ ok: true, message: "Email seed processing started" });
}

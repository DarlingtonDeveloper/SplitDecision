import { getSupabaseAdmin } from "../supabase";
import { logAction } from "../actions";
import { parseBrief } from "./brief-parser";
import { matchBeats } from "./matcher";
import { draftNegotiationReply } from "./negotiator";
import { createDraft } from "../drafts";
import { createPayPalOrder } from "../paypal";

export async function processBrief(input: {
  source: "email" | "whatsapp" | "seed";
  from_contact: string;
  raw_text: string;
  to_address?: string;
}) {
  const supabase = getSupabaseAdmin();

  await logAction({
    pillar: "negotiation",
    trigger: input.source,
    action_taken: `Ingested brief from ${input.from_contact}`,
    channel: input.source,
  });

  const parsed = await parseBrief(input.raw_text);

  await logAction({
    pillar: "negotiation",
    trigger: "brief_parser",
    action_taken: `Parsed brief: ${parsed.caption.slice(0, 80)}…`,
    channel: "internal",
  });

  const matches = await matchBeats(parsed);

  await logAction({
    pillar: "negotiation",
    trigger: "clap_matcher",
    action_taken: `Matched ${matches.length} beats (top: ${matches[0]?.title ?? "none"})`,
    channel: "internal",
  });

  const { data: brief } = await supabase
    .from("briefs")
    .insert({
      source: input.source,
      from_contact: input.from_contact,
      raw_text: input.raw_text,
      caption: parsed.caption,
      parsed_attributes: parsed,
      matched_beat_ids: matches.map((m) => m.id),
      status: "matched",
    })
    .select("*")
    .single();

  const topBeat = matches[0];
  const leaseAmount = topBeat?.license_tiers?.lease ?? 50;

  let paymentLink: string | undefined;
  if (topBeat) {
    try {
      const order = await createPayPalOrder({
        amount: leaseAmount,
        description: `Lease: ${topBeat.title}`,
        beatId: topBeat.id,
      });
      paymentLink = order.approvalUrl;
      await supabase.from("sales").insert({
        beat_id: topBeat.id,
        tier: "lease",
        paypal_order_id: order.orderId,
        amount: leaseAmount,
        status: "created",
      });
    } catch (e) {
      console.warn("[pipeline] PayPal order skipped:", e);
    }
  }

  const matchSummary = matches
    .map((m, i) => `${i + 1}. ${m.title} (${(m.score * 100).toFixed(0)}%) — ${m.why}`)
    .join("\n");

  const negotiation = await draftNegotiationReply({
    counterparty: input.from_contact,
    recordTitle: topBeat?.title ?? "TBD",
    threadText: input.raw_text,
    context: `Matched beats:\n${matchSummary}\nDeal context: ${parsed.deal_context ?? "standard lease"}`,
  });

  await logAction({
    pillar: "negotiation",
    trigger: "splits_agent",
    action_taken: negotiation.position_summary,
    channel: "internal",
  });

  const reasoning = [
    `Brief caption: ${parsed.caption}`,
    `Matches:\n${matchSummary}`,
    `Negotiation trace: ${negotiation.tradeoffs}`,
    negotiation.escalation_reason
      ? `Escalation: ${negotiation.escalation_reason}`
      : null,
  ]
    .filter(Boolean)
    .join("\n\n");

  await createDraft({
    pillar: "negotiation",
    related_id: brief?.id,
    to_address: input.to_address ?? `${input.from_contact.replace(/\s+/g, "").toLowerCase()}@label.com`,
    subject: `Re: beat brief — ${topBeat?.title ?? "options"} for your artist`,
    body: negotiation.draft_message,
    payment_link: paymentLink,
    reasoning,
    whatsappCard: {
      headline: `Re: "${topBeat?.title ?? "Brief"}" — ${input.from_contact}`,
      lines: [
        `Their context: ${parsed.deal_context ?? "lease enquiry"}`,
        `Top match: ${topBeat?.title ?? "n/a"} (${topBeat ? (matches[0].score * 100).toFixed(0) + "%" : "—"})`,
        `My counter: ${negotiation.our_counter.publishing} pub, ${negotiation.our_counter.points} pts`,
        negotiation.position_summary,
      ],
      warning: negotiation.needs_human
        ? negotiation.escalation_reason ?? "Review recommended"
        : undefined,
    },
  });

  return { brief, matches, negotiation };
}

export async function processNegotiationEmail(input: {
  from: string;
  subject: string;
  body: string;
}) {
  const supabase = getSupabaseAdmin();

  const { data: neg } = await supabase
    .from("negotiations")
    .insert({
      counterparty: input.from,
      record_title: input.subject,
      thread: [{ role: "them", text: input.body, ts: new Date().toISOString() }],
    })
    .select("*")
    .single();

  await logAction({
    pillar: "negotiation",
    trigger: "email",
    action_taken: `Negotiation thread opened: ${input.subject}`,
    channel: "email",
  });

  const negotiation = await draftNegotiationReply({
    counterparty: input.from,
    recordTitle: input.subject,
    threadText: input.body,
  });

  await createDraft({
    pillar: "negotiation",
    related_id: neg?.id,
    to_address: input.from.includes("@") ? input.from : undefined,
    subject: `Re: ${input.subject}`,
    body: negotiation.draft_message,
    reasoning: JSON.stringify(negotiation, null, 2),
    whatsappCard: {
      headline: `Re: "${input.subject}" — ${input.from}`,
      lines: [
        `Their offer: ${negotiation.their_offer.publishing} pub, ${negotiation.their_offer.points} pts`,
        `My counter: ${negotiation.our_counter.publishing} pub, ${negotiation.our_counter.points} pts`,
        negotiation.position_summary,
      ],
      warning: negotiation.needs_human
        ? negotiation.escalation_reason ?? "Below floor"
        : undefined,
    },
  });
}

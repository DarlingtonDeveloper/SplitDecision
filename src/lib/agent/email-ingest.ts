import { listUnread, fetchMessage, markRead } from "../gmail";
import { classifyEmail } from "./email-classifier";
import { processBrief, processNegotiationEmail } from "./pipeline";
import { logAction } from "../actions";
import { getSupabaseAdmin } from "../supabase";

/**
 * Poll Gmail inbox for unread messages, classify, and route.
 * Called by the cron route or Modal job.
 */
export async function pollInbox(): Promise<{ processed: number; skipped: number }> {
  const ids = await listUnread(10);
  let processed = 0;
  let skipped = 0;

  for (const id of ids) {
    try {
      // Dedupe: check if we've already processed this Gmail message id
      if (await isAlreadyProcessed(id)) {
        skipped++;
        await markRead(id);
        continue;
      }

      const msg = await fetchMessage(id);
      if (!msg || !msg.body.trim()) {
        skipped++;
        await markRead(id);
        continue;
      }

      await logAction({
        pillar: "negotiation",
        trigger: "email_poll",
        action_taken: `Email received from ${msg.from}: "${msg.subject}"`,
        channel: "email",
      });

      const classified = await classifyEmail({
        from: msg.from,
        subject: msg.subject,
        body: msg.body,
      });

      await logAction({
        pillar: "negotiation",
        trigger: "email_classifier",
        action_taken: `Classified as ${classified.kind} (from: ${classified.from_role})`,
        channel: "internal",
      });

      if (classified.kind === "new_brief") {
        await processBrief({
          source: "email",
          from_contact: msg.from,
          raw_text: msg.rawBody,
          to_address: extractEmail(msg.from),
          gmailMessageId: msg.id,
          gmailThreadId: msg.threadId,
          lastMessageIdHeader: msg.messageIdHeader,
        });
        processed++;
      } else if (classified.kind === "negotiation_reply") {
        await processNegotiationReply(msg, classified);
        processed++;
      } else {
        skipped++;
        await logAction({
          pillar: "catalogue",
          trigger: "email_classifier",
          action_taken: `Skipped email (kind: other): "${msg.subject}"`,
          channel: "email",
        });
      }

      await markRead(id);
    } catch (err) {
      console.error(`[email-ingest] Failed to process message ${id}:`, err);
    }
  }

  return { processed, skipped };
}

/** Route a negotiation reply — match to existing thread or open new one. */
async function processNegotiationReply(
  msg: Awaited<ReturnType<typeof fetchMessage>> & {},
  classified: Awaited<ReturnType<typeof classifyEmail>>,
) {
  const supabase = getSupabaseAdmin();

  // Try to find an existing negotiation by Gmail thread id
  const { data: existing } = await supabase
    .from("negotiations")
    .select("*")
    .eq("gmail_thread_id", msg.threadId)
    .maybeSingle();

  if (existing) {
    // Append to existing thread
    const thread = Array.isArray(existing.thread) ? existing.thread : [];
    thread.push({
      role: "them",
      text: msg.body,
      ts: new Date().toISOString(),
    });

    await supabase
      .from("negotiations")
      .update({
        thread,
        their_terms: classified.their_terms ?? existing.their_terms,
        last_message_id: msg.messageIdHeader,
      })
      .eq("id", existing.id);

    // Re-run negotiator against updated thread
    const fullThread = thread.map((t: { role: string; text: string }) => `[${t.role}]: ${t.text}`).join("\n\n");

    await processNegotiationEmail({
      from: msg.from,
      subject: msg.subject,
      body: fullThread,
      gmailThreadId: msg.threadId,
      lastMessageIdHeader: msg.messageIdHeader,
      negotiationId: existing.id,
    });
  } else {
    // New negotiation thread
    await processNegotiationEmail({
      from: msg.from,
      subject: msg.subject,
      body: msg.body,
      gmailThreadId: msg.threadId,
      lastMessageIdHeader: msg.messageIdHeader,
    });
  }
}

/** Check if a Gmail message id has already been processed. */
async function isAlreadyProcessed(gmailMessageId: string): Promise<boolean> {
  const supabase = getSupabaseAdmin();

  // Check briefs
  const { data: brief } = await supabase
    .from("briefs")
    .select("id")
    .eq("gmail_message_id", gmailMessageId)
    .maybeSingle();

  if (brief) return true;

  // Check seen_messages table (used by webhook dedupe too)
  const { data: seen } = await supabase
    .from("seen_messages")
    .select("message_id")
    .eq("message_id", `gmail:${gmailMessageId}`)
    .maybeSingle();

  if (seen) return true;

  // Mark as seen
  await supabase.from("seen_messages").insert({ message_id: `gmail:${gmailMessageId}` });
  return false;
}

/** Extract email address from "Name <email>" format. */
function extractEmail(from: string): string {
  const match = from.match(/<([^>]+)>/);
  return match?.[1] ?? from;
}

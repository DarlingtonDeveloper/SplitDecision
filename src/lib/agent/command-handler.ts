import { parseCommand, helpText } from "../commands";
import {
  approveDraft,
  getDraftReasoning,
  getStatusSummary,
  rejectDraft,
} from "../drafts";
import { sendWhatsApp } from "../whatsapp";
import { getProducerWhatsApp } from "../config";
import { draftNegotiationReply } from "./negotiator";
import { getSupabaseAdmin } from "../supabase";
import { createDraft } from "../drafts";
import { logAction } from "../actions";

let scoutsPaused = false;

export async function handleWhatsAppCommand(from: string, body: string) {
  const producer = getProducerWhatsApp();
  const replyTo = from === producer || from.includes(producer.slice(-8)) ? producer : producer;

  const cmd = parseCommand(body);

  switch (cmd.verb) {
    case "OK":
      if (!cmd.code) return sendWhatsApp(replyTo, "Usage: OK <code>");
      await approveDraft(cmd.code);
      break;
    case "NO":
      if (!cmd.code) return sendWhatsApp(replyTo, "Usage: NO <code>");
      await rejectDraft(cmd.code);
      break;
    case "WHY":
      if (!cmd.code) return sendWhatsApp(replyTo, "Usage: WHY <code>");
      await sendWhatsApp(replyTo, await getDraftReasoning(cmd.code));
      break;
    case "EDIT":
      if (!cmd.code || !cmd.note) {
        return sendWhatsApp(replyTo, "Usage: EDIT <code> <note>");
      }
      await handleEdit(cmd.code, cmd.note);
      break;
    case "STATUS":
      await sendWhatsApp(replyTo, await getStatusSummary());
      break;
    case "PAUSE":
      scoutsPaused = true;
      await sendWhatsApp(replyTo, "⏸ Scouts paused.");
      break;
    case "RESUME":
      scoutsPaused = false;
      await sendWhatsApp(replyTo, "▶️ Scouts resumed.");
      break;
    case "HELP":
      await sendWhatsApp(replyTo, helpText());
      break;
    default:
      await sendWhatsApp(
        replyTo,
        `Echo: ${body}\n\n${helpText()}`
      );
  }
}

async function handleEdit(code: string, note: string) {
  const supabase = getSupabaseAdmin();
  const { data: draft } = await supabase
    .from("drafts")
    .select("*")
    .eq("short_code", code.toUpperCase())
    .single();

  if (!draft) {
    await sendWhatsApp(getProducerWhatsApp(), `Draft #${code} not found.`);
    return;
  }

  await supabase
    .from("drafts")
    .update({ status: "editing" })
    .eq("id", draft.id);

  const revised = await draftNegotiationReply({
    counterparty: draft.to_address ?? "counterparty",
    recordTitle: draft.subject ?? "record",
    threadText: `${draft.body}\n\nProducer note: ${note}`,
  });

  await createDraft({
    pillar: draft.pillar,
    related_id: draft.related_id,
    to_address: draft.to_address,
    subject: draft.subject,
    body: revised.draft_message,
    payment_link: draft.payment_link,
    reasoning: `${draft.reasoning}\n\nEdit note: ${note}`,
    whatsappCard: {
      headline: `Revised #${code} — ${draft.subject ?? "draft"}`,
      lines: [revised.position_summary, `Edit: ${note}`],
      warning: revised.needs_human ? revised.escalation_reason ?? undefined : undefined,
    },
  });

  await logAction({
    pillar: draft.pillar,
    trigger: "producer_edit",
    action_taken: `Regenerated draft from #${code} with note`,
    channel: "whatsapp",
    is_autonomous: false,
    draft_short_code: code.toUpperCase(),
  });
}

export function areScoutsPaused() {
  return scoutsPaused;
}

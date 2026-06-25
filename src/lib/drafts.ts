import { getSupabaseAdmin } from "./supabase";
import { logAction } from "./actions";
import { nextShortCode } from "./short-code";
import {
  formatDraftCard,
  formatSentConfirmation,
  sendWhatsApp,
} from "./whatsapp";
import { getProducerWhatsApp } from "./config";
import { sendEmail } from "./email";
import type { Draft, Pillar } from "./types";

export async function createDraft(input: {
  pillar: Pillar;
  related_id?: string;
  to_address?: string;
  subject?: string;
  body?: string;
  payment_link?: string;
  reasoning?: string;
  whatsappCard?: {
    headline: string;
    lines: string[];
    warning?: string;
  };
}): Promise<Draft> {
  const supabase = getSupabaseAdmin();
  const short_code = await nextShortCode();

  const { data, error } = await supabase
    .from("drafts")
    .insert({
      short_code,
      pillar: input.pillar,
      related_id: input.related_id ?? null,
      to_address: input.to_address ?? null,
      subject: input.subject ?? null,
      body: input.body ?? null,
      payment_link: input.payment_link ?? null,
      reasoning: input.reasoning ?? null,
      status: "pending_approval",
    })
    .select("*")
    .single();

  if (error || !data) throw new Error(error?.message ?? "Draft insert failed");

  await logAction({
    pillar: input.pillar,
    trigger: "draft_created",
    action_taken: `Draft #${short_code} queued for approval`,
    channel: "whatsapp",
    is_autonomous: true,
    draft_short_code: short_code,
  });

  if (input.whatsappCard) {
    const card = formatDraftCard({
      shortCode: short_code,
      pillar: input.pillar.charAt(0).toUpperCase() + input.pillar.slice(1),
      headline: input.whatsappCard.headline,
      lines: input.whatsappCard.lines,
      warning: input.whatsappCard.warning,
    });
    await sendWhatsApp(getProducerWhatsApp(), card);
  }

  return data as Draft;
}

export async function approveDraft(shortCode: string): Promise<Draft> {
  const supabase = getSupabaseAdmin();
  const code = shortCode.toUpperCase();

  const { data: draft, error } = await supabase
    .from("drafts")
    .select("*")
    .eq("short_code", code)
    .single();

  if (error || !draft) throw new Error(`Draft ${code} not found`);
  if (draft.status !== "pending_approval" && draft.status !== "editing") {
    throw new Error(`Draft ${code} is ${draft.status}, cannot approve`);
  }

  if (draft.channel === "email" && draft.to_address && draft.body) {
    let body = draft.body;
    if (draft.payment_link) {
      body += `\n\nLease payment link: ${draft.payment_link}`;
    }
    await sendEmail({
      to: draft.to_address,
      subject: draft.subject ?? "Re: your enquiry",
      body,
    });
  }

  const { data: updated } = await supabase
    .from("drafts")
    .update({ status: "sent" })
    .eq("id", draft.id)
    .select("*")
    .single();

  await logAction({
    pillar: draft.pillar,
    trigger: "producer_ok",
    action_taken: `Producer approved #${code} — sent via ${draft.channel}`,
    channel: draft.channel,
    is_autonomous: false,
    draft_short_code: code,
  });

  await sendWhatsApp(
    getProducerWhatsApp(),
    formatSentConfirmation({
      shortCode: code,
      to: draft.to_address ?? "counterparty",
      extra: draft.payment_link ? "Lease link attached." : undefined,
    })
  );

  return (updated ?? draft) as Draft;
}

export async function rejectDraft(shortCode: string): Promise<void> {
  const supabase = getSupabaseAdmin();
  const code = shortCode.toUpperCase();

  await supabase
    .from("drafts")
    .update({ status: "rejected" })
    .eq("short_code", code);

  await logAction({
    trigger: "producer_no",
    action_taken: `Producer rejected #${code}`,
    channel: "whatsapp",
    is_autonomous: false,
    draft_short_code: code,
  });

  await sendWhatsApp(getProducerWhatsApp(), `❌ Rejected #${code}. Draft archived.`);
}

export async function getDraftReasoning(shortCode: string): Promise<string> {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from("drafts")
    .select("reasoning, short_code")
    .eq("short_code", shortCode.toUpperCase())
    .single();

  return data?.reasoning ?? `No reasoning stored for #${shortCode}.`;
}

export async function getStatusSummary(): Promise<string> {
  const supabase = getSupabaseAdmin();
  const [drafts, briefs, sales, agentActions, approvals] = await Promise.all([
    supabase.from("drafts").select("id", { count: "exact", head: true }).eq("status", "pending_approval"),
    supabase.from("briefs").select("id", { count: "exact", head: true }).eq("status", "new"),
    supabase.from("sales").select("amount").eq("status", "captured"),
    supabase.from("actions").select("id", { count: "exact", head: true }).eq("is_autonomous", true),
    supabase.from("actions").select("id", { count: "exact", head: true }).eq("is_autonomous", false),
  ]);

  const salesTotal = (sales.data ?? []).reduce(
    (sum, s) => sum + Number(s.amount ?? 0),
    0
  );

  return [
    "📊 STATUS",
    `Open drafts: ${drafts.count ?? 0}`,
    `New briefs: ${briefs.count ?? 0}`,
    `Sales total: £${salesTotal}`,
    `Agent actions: ${agentActions.count ?? 0}`,
    `Producer approvals: ${approvals.count ?? 0}`,
  ].join("\n");
}

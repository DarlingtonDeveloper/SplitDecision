import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";

export async function GET() {
  const supabase = getSupabaseAdmin();

  const [
    actions,
    agentCount,
    approvalCount,
    pendingDrafts,
    newBriefs,
    sales,
    beats,
    drafts,
    briefs,
    negotiations,
    contacts,
  ] = await Promise.all([
    supabase
      .from("actions")
      .select("*")
      .order("ts", { ascending: false })
      .limit(50),
    supabase
      .from("actions")
      .select("id", { count: "exact", head: true })
      .eq("is_autonomous", true),
    supabase
      .from("actions")
      .select("id", { count: "exact", head: true })
      .eq("is_autonomous", false),
    supabase
      .from("drafts")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending_approval"),
    supabase
      .from("briefs")
      .select("id", { count: "exact", head: true })
      .eq("status", "new"),
    supabase.from("sales").select("amount, status"),
    supabase
      .from("beats")
      .select("id, title, bpm, music_key, mood_tags, genre, reference_artists, license_tiers, status, audio_url")
      .order("title"),
    supabase
      .from("drafts")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("briefs")
      .select("id, source, from_contact, caption, parsed_attributes, matched_beat_ids, status, created_at")
      .order("created_at", { ascending: false })
      .limit(30),
    supabase
      .from("negotiations")
      .select("id, counterparty, record_title, thread, their_terms, our_position, status, needs_human, created_at")
      .order("created_at", { ascending: false })
      .limit(30),
    supabase
      .from("contacts")
      .select("*")
      .order("name"),
  ]);

  const salesTotal = (sales.data ?? [])
    .filter((s) => s.status === "captured")
    .reduce((sum, s) => sum + Number(s.amount ?? 0), 0);

  return NextResponse.json({
    counters: {
      agentActions: agentCount.count ?? 0,
      producerApprovals: approvalCount.count ?? 0,
      pendingDrafts: pendingDrafts.count ?? 0,
      newBriefs: newBriefs.count ?? 0,
      salesTotal,
    },
    feed: actions.data ?? [],
    beats: beats.data ?? [],
    drafts: drafts.data ?? [],
    briefs: briefs.data ?? [],
    negotiations: negotiations.data ?? [],
    contacts: contacts.data ?? [],
  });
}

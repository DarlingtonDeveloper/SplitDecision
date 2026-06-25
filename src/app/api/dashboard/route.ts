import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";

export async function GET() {
  const supabase = getSupabaseAdmin();

  const [actions, agentCount, approvalCount, pendingDrafts, newBriefs, sales] =
    await Promise.all([
      supabase
        .from("actions")
        .select("*")
        .order("ts", { ascending: false })
        .limit(30),
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
  });
}

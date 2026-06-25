import { NextResponse } from "next/server";
import { runOutreachScout } from "@/lib/agent/outreach";

export const runtime = "nodejs";

/** Trigger outreach scout manually or from Modal cron. */
export async function POST() {
  void runOutreachScout().catch(console.error);
  return NextResponse.json({ ok: true });
}

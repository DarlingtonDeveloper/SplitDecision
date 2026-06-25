import { NextResponse } from "next/server";
import { pollInbox } from "@/lib/agent/email-ingest";
import { isGmailConfigured } from "@/lib/gmail";

export const runtime = "nodejs";

/**
 * POST /api/cron/poll-inbox
 * Poll Gmail for new messages. Called by Modal cron (~20s) or manually.
 */
export async function POST() {
  if (!isGmailConfigured()) {
    return NextResponse.json({ ok: false, error: "Gmail not configured" }, { status: 503 });
  }

  void pollInbox().catch(console.error);
  return NextResponse.json({ ok: true, message: "Inbox poll started" });
}

/** GET for easy testing */
export async function GET() {
  return POST();
}

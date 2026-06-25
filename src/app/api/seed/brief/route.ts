import { NextRequest, NextResponse } from "next/server";
import { processBrief } from "@/lib/agent/pipeline";

export const runtime = "nodejs";
export const maxDuration = 60;

const DEMO_BRIEF = `From: Sable (A&R, Polydor)
Subject: Beat brief — developing artist

Need something dark, Utopia-era Travis Scott vibe, around 140 BPM, minor key.
For a developing artist on the roster — non-exclusive lease budget ~£500.
References: dark trap, atmospheric, spacey pads.`;

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const raw_text = (body.raw_text ?? DEMO_BRIEF) as string;
  const from_contact = (body.from_contact ?? "Sable (A&R, Polydor)") as string;
  const to_address = body.to_address as string | undefined;

  void processBrief({
    source: "seed",
    from_contact,
    raw_text,
    to_address: to_address ?? "sable@polydor.com",
  }).catch(console.error);

  return NextResponse.json({ ok: true, message: "Brief processing started" });
}

export async function GET() {
  return POST(
    new NextRequest("http://local/seed", { method: "POST", body: "{}" })
  );
}

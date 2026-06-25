import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const { audio_url } = (await req.json()) as { audio_url?: string };
  if (!audio_url) {
    return NextResponse.json({ error: "audio_url required" }, { status: 400 });
  }

  const modalUrl = process.env.MODAL_CLAP_AUDIO_URL;
  if (modalUrl) {
    const res = await fetch(modalUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ audio_url }),
    });
    if (res.ok) return NextResponse.json(await res.json());
  }

  const embedding = pseudoEmbed(audio_url, 512);
  return NextResponse.json({ embedding });
}

function pseudoEmbed(text: string, dim: number): number[] {
  const out = new Array(dim).fill(0);
  for (let i = 0; i < text.length; i++) {
    out[(i * 7) % dim] += text.charCodeAt(i) / 255;
  }
  const norm = Math.sqrt(out.reduce((s, v) => s + v * v, 0)) || 1;
  return out.map((v) => v / norm);
}

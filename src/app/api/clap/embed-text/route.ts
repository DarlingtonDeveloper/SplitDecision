import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

/** Proxy to Modal CLAP text encoder, with deterministic fallback for demo. */
export async function POST(req: NextRequest) {
  const { text } = (await req.json()) as { text?: string };
  if (!text) return NextResponse.json({ error: "text required" }, { status: 400 });

  const modalUrl = process.env.MODAL_CLAP_TEXT_URL;
  if (modalUrl) {
    const res = await fetch(modalUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (res.ok) {
      return NextResponse.json(await res.json());
    }
  }

  // Demo fallback: hash text into 512-dim pseudo-embedding
  const embedding = pseudoEmbed(text, 512);
  return NextResponse.json({ embedding });
}

function pseudoEmbed(text: string, dim: number): number[] {
  const out = new Array(dim).fill(0);
  for (let i = 0; i < text.length; i++) {
    out[i % dim] += text.charCodeAt(i) / 255;
  }
  const norm = Math.sqrt(out.reduce((s, v) => s + v * v, 0)) || 1;
  return out.map((v) => v / norm);
}

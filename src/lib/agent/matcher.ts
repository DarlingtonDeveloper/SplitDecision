import { getSupabaseAdmin } from "../supabase";
import { explainMatch } from "./brief-parser";
import type { BeatMatch, ParsedBrief } from "../types";

async function embedCaption(caption: string): Promise<number[]> {
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ??
    (process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:3000");

  const res = await fetch(`${baseUrl}/api/clap/embed-text`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: caption }),
  });

  if (!res.ok) {
    throw new Error(`CLAP embed failed: ${await res.text()}`);
  }

  const { embedding } = (await res.json()) as { embedding: number[] };
  return embedding;
}

export async function matchBeats(
  parsed: ParsedBrief,
  limit = 3
): Promise<BeatMatch[]> {
  const supabase = getSupabaseAdmin();
  const embedding = await embedCaption(parsed.caption);

  const bpmMin = parsed.bpm_range?.[0] ?? null;
  const bpmMax = parsed.bpm_range?.[1] ?? null;
  const keyFilter = parsed.key;

  const { data, error } = await supabase.rpc("match_beats", {
    query_embedding: embedding,
    bpm_min: bpmMin,
    bpm_max: bpmMax,
    key_filter: keyFilter,
    match_limit: limit,
  });

  if (error) {
    // Fallback if RPC not created yet — raw query via REST isn't ideal for vectors,
    // so return empty and let seed/demo still work.
    console.warn("[matcher] RPC match_beats failed:", error.message);
    const { data: allBeats } = await supabase
      .from("beats")
      .select("id, title, bpm, music_key, mood_tags, license_tiers")
      .eq("status", "available")
      .limit(limit);

    const matches: BeatMatch[] = [];
    for (const beat of allBeats ?? []) {
      matches.push({
        ...beat,
        score: 0.5,
        why: await explainMatch(parsed.caption, beat),
      });
    }
    return matches;
  }

  const matches: BeatMatch[] = [];
  for (const row of data ?? []) {
    matches.push({
      id: row.id,
      title: row.title,
      bpm: row.bpm,
      music_key: row.music_key,
      mood_tags: row.mood_tags,
      license_tiers: row.license_tiers,
      score: row.score,
      why: await explainMatch(parsed.caption, row),
    });
  }

  return matches;
}

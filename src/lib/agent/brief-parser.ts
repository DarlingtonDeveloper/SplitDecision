import { completeJson, completeText } from "../llm";
import type { ParsedBrief } from "../types";

const SYSTEM = `You convert a music brief from an A&R exec or music supervisor into structured
search terms for a beat catalogue. Output strict JSON, no prose.

{
  "caption": "<one dense descriptive line a music-tagging model would output:
              genre, mood, energy, era, reference vibe. No fluff.>",
  "bpm_range": [min, max] | null,
  "key": "<e.g. 'minor' or 'F# minor'>" | null,
  "mood": ["..."],
  "reference_artists": ["..."],
  "energy": "low|medium|high" | null,
  "deal_context": "<exclusivity, budget, artist tier if mentioned>" | null
}

If a field is not stated, use null. Never invent reference artists.`;

export async function parseBrief(rawText: string): Promise<ParsedBrief> {
  return completeJson<ParsedBrief>(SYSTEM, rawText);
}

export async function explainMatch(
  briefCaption: string,
  beat: { title: string; mood_tags?: string[] | null; bpm?: number | null; music_key?: string | null }
): Promise<string> {
  return completeText(
    "You explain beat matches in one concise sentence for a producer. No fluff.",
    `Brief: ${briefCaption}\nBeat: ${beat.title}, tags: ${(beat.mood_tags ?? []).join(", ")}, bpm: ${beat.bpm}, key: ${beat.music_key}`
  );
}

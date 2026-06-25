import { completeJson } from "../llm";

const SYSTEM_PROMPT = `You triage inbound email to a music producer's manager agent. Read the new
message content (quoted history already removed). Output strict JSON, no prose.

{
  "kind": "new_brief" | "negotiation_reply" | "other",
  "from_role": "anr" | "label" | "artist" | "unknown",

  // if new_brief, also include:
  "brief": {
    "caption": "<dense one-line description for an audio-tagging model: genre, mood, energy, era, reference vibe>",
    "bpm_range": [min, max] | null,
    "key": "<e.g. 'minor' or 'F# minor'>" | null,
    "mood": ["..."],
    "reference_artists": ["..."],
    "deal_context": "<budget, exclusivity, artist tier if stated>" | null
  },

  // if negotiation_reply, also include:
  "their_terms": {
    "publishing": "<e.g. '60/40 their favour'>" | null,
    "points": "<e.g. '2'>" | null,
    "upfront": "<e.g. '£300'>" | null,
    "exclusivity": "lease" | "exclusive" | "buyout" | "unspecified" | null,
    "other": "<anything else material>" | null
  }
}

Never invent reference artists, numbers, or terms. Unknown → null.
If it doesn't look like a brief or negotiation (e.g. newsletters, spam, personal), return kind "other" with no brief or their_terms.`;

export interface ClassifiedEmail {
  kind: "new_brief" | "negotiation_reply" | "other";
  from_role: "anr" | "label" | "artist" | "unknown";
  brief?: {
    caption: string;
    bpm_range: [number, number] | null;
    key: string | null;
    mood: string[];
    reference_artists: string[];
    deal_context: string | null;
  };
  their_terms?: {
    publishing: string | null;
    points: string | null;
    upfront: string | null;
    exclusivity: string | null;
    other: string | null;
  };
}

export async function classifyEmail(input: {
  from: string;
  subject: string;
  body: string;
}): Promise<ClassifiedEmail> {
  const userMsg = `From: ${input.from}\nSubject: ${input.subject}\n\n${input.body}`;
  return completeJson<ClassifiedEmail>(SYSTEM_PROMPT, userMsg);
}

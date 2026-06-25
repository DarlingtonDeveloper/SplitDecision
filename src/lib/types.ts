export type Pillar = "outreach" | "negotiation" | "catalogue";

export type DraftStatus =
  | "pending_approval"
  | "approved"
  | "sent"
  | "rejected"
  | "editing";

export interface ParsedBrief {
  caption: string;
  bpm_range: [number, number] | null;
  key: string | null;
  mood: string[];
  reference_artists: string[];
  energy: "low" | "medium" | "high" | null;
  deal_context: string | null;
}

export interface BeatMatch {
  id: string;
  title: string;
  bpm: number | null;
  music_key: string | null;
  mood_tags: string[] | null;
  license_tiers: Record<string, number> | null;
  score: number;
  why: string;
}

export interface NegotiationDraft {
  draft_message: string;
  position_summary: string;
  their_offer: Record<string, string>;
  our_counter: Record<string, string>;
  tradeoffs: string;
  needs_human: boolean;
  escalation_reason: string | null;
}

export interface WhatsAppCommand {
  verb: "OK" | "NO" | "EDIT" | "WHY" | "STATUS" | "PAUSE" | "RESUME" | "HELP" | "UNKNOWN";
  code?: string;
  note?: string;
}

export interface Draft {
  id: string;
  short_code: string;
  pillar: Pillar;
  related_id: string | null;
  channel: string;
  to_address: string | null;
  subject: string | null;
  body: string | null;
  payment_link: string | null;
  reasoning: string | null;
  status: DraftStatus;
  created_at: string;
}

export interface Action {
  id: string;
  ts: string;
  pillar: string | null;
  trigger: string | null;
  action_taken: string;
  channel: string | null;
  is_autonomous: boolean;
  draft_short_code: string | null;
}

export interface ProducerConfig {
  name: string;
  pubTarget: number;
  pubFloor: number;
  pointsTarget: number;
  pointsFloor: number;
  models: string;
  minUpfront: number;
  relationshipMode: string;
}

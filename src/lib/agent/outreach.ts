import { getSupabaseAdmin } from "../supabase";
import { logAction } from "../actions";
import { createDraft } from "../drafts";
import { completeText } from "../llm";
import { areScoutsPaused } from "./command-handler";

/** Lite outreach scout — picks a beat and drafts a cold intro. */
export async function runOutreachScout() {
  if (areScoutsPaused()) return;

  const supabase = getSupabaseAdmin();
  const { data: beats } = await supabase
    .from("beats")
    .select("id, title, genre, mood_tags, reference_artists, license_tiers")
    .eq("status", "available")
    .limit(5);

  if (!beats?.length) return;

  const beat = beats[Math.floor(Math.random() * beats.length)];
  const targetArtist = "Emerging artist (scout target)";

  await logAction({
    pillar: "outreach",
    trigger: "modal_cron",
    action_taken: `Scout identified fit: ${beat.title} → ${targetArtist}`,
    channel: "internal",
  });

  const body = await completeText(
    "Draft a short, personalised beat intro email for a producer. Warm, professional, one beat mention, no hard sell.",
    `Beat: ${beat.title}, genre: ${beat.genre}, moods: ${(beat.mood_tags ?? []).join(", ")}, refs: ${(beat.reference_artists ?? []).join(", ")}`
  );

  await createDraft({
    pillar: "outreach",
    related_id: beat.id,
    to_address: "artist@example.com",
    subject: `Beat fit — ${beat.title}`,
    body,
    reasoning: `Scout matched ${beat.title} to ${targetArtist} based on catalogue tags.`,
    whatsappCard: {
      headline: `Outreach → ${targetArtist}`,
      lines: [`Beat: ${beat.title}`, `Draft intro ready for review`],
    },
  });
}

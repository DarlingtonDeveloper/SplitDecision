import { getSupabaseAdmin } from "../supabase";
import { logAction } from "../actions";
import { createDraft } from "../drafts";
import { completeJson, completeText } from "../llm";
import { areScoutsPaused } from "./command-handler";
import { searchForArtists, searchForContact } from "../search";

interface DiscoveredArtist {
  name: string;
  genre: string;
  why_good_fit: string;
  management_contact: string | null;
  email: string | null;
  source_url: string | null;
}

const EXTRACT_SYSTEM = `You are a music industry research agent. Given web search results about emerging artists,
extract the most promising artist who would be a good fit for a beat placement.

Output strict JSON:
{
  "name": "<artist name>",
  "genre": "<their genre>",
  "why_good_fit": "<one sentence: why this artist fits the beat>",
  "management_contact": "<manager name if found, or null>",
  "email": "<email if found in the search results, or null>",
  "source_url": "<URL where you found the info, or null>"
}

Only extract real information from the search results. Never invent emails or contacts.
If no good fit is found, return name "none".`;

const CONTACT_EXTRACT_SYSTEM = `You extract music artist management contact information from web search results.
Output strict JSON:
{
  "manager_name": "<name or null>",
  "email": "<email address if found, or null>",
  "phone": "<phone number if found, or null>",
  "source": "<where you found it>"
}

Only extract real information visible in the search results. Never invent or guess emails.`;

/**
 * Outreach scout — finds real artists via web search,
 * extracts contact info, drafts a personalised intro email.
 */
export async function runOutreachScout() {
  if (areScoutsPaused()) return;

  const supabase = getSupabaseAdmin();

  // Pick a random available beat
  const { data: beats } = await supabase
    .from("beats")
    .select("id, title, genre, mood_tags, reference_artists, license_tiers, bpm, music_key")
    .eq("status", "available")
    .limit(10);

  if (!beats?.length) return;

  const beat = beats[Math.floor(Math.random() * beats.length)];

  await logAction({
    pillar: "outreach",
    trigger: "scout",
    action_taken: `Scouting artists for "${beat.title}" (${beat.genre}, ${(beat.mood_tags ?? []).join(", ")})`,
    channel: "internal",
  });

  // Step 1: Search for matching artists
  const artistResults = await searchForArtists(beat);

  if (!artistResults.length) {
    await logAction({
      pillar: "outreach",
      trigger: "scout",
      action_taken: `No search results for "${beat.title}" — skipping`,
      channel: "internal",
    });
    return;
  }

  // Step 2: LLM extracts the best-fit artist from search results
  const resultsText = artistResults
    .map((r, i) => `${i + 1}. ${r.title}\n   ${r.url}\n   ${r.description}`)
    .join("\n\n");

  const artist = await completeJson<DiscoveredArtist>(
    EXTRACT_SYSTEM,
    `Beat: "${beat.title}" — ${beat.genre}, moods: ${(beat.mood_tags ?? []).join(", ")}, refs: ${(beat.reference_artists ?? []).join(", ")}, ${beat.bpm ?? "?"}bpm, ${beat.music_key ?? "?"}\n\nSearch results:\n${resultsText}`
  );

  if (!artist.name || artist.name.toLowerCase() === "none") {
    await logAction({
      pillar: "outreach",
      trigger: "scout",
      action_taken: `No good artist match found for "${beat.title}"`,
      channel: "internal",
    });
    return;
  }

  await logAction({
    pillar: "outreach",
    trigger: "scout",
    action_taken: `Found artist: ${artist.name} — ${artist.why_good_fit}`,
    channel: "internal",
  });

  // Step 3: Search for contact info if not already found
  let email = artist.email;
  let managerName = artist.management_contact;

  if (!email) {
    const contactResults = await searchForContact(artist.name);
    if (contactResults.length) {
      const contactText = contactResults
        .map((r, i) => `${i + 1}. ${r.title}\n   ${r.url}\n   ${r.description}`)
        .join("\n\n");

      const contact = await completeJson<{
        manager_name: string | null;
        email: string | null;
        phone: string | null;
        source: string | null;
      }>(CONTACT_EXTRACT_SYSTEM, `Artist: ${artist.name}\n\nSearch results:\n${contactText}`);

      email = contact.email;
      managerName = managerName ?? contact.manager_name;

      if (contact.phone) {
        // Store phone too if found
        await logAction({
          pillar: "outreach",
          trigger: "scout",
          action_taken: `Found contact for ${artist.name}: ${managerName ?? "direct"} — ${email ?? "no email"}, phone: ${contact.phone}`,
          channel: "internal",
        });
      }
    }
  }

  // Step 4: Save to contacts table
  const { data: existingContact } = await supabase
    .from("contacts")
    .select("id")
    .eq("name", artist.name)
    .maybeSingle();

  if (!existingContact) {
    await supabase.from("contacts").insert({
      name: artist.name,
      role: "artist",
      email: email ?? null,
      notes: `${artist.genre}. ${artist.why_good_fit}. Source: ${artist.source_url ?? "web search"}`,
    });
  }

  // Step 5: Draft personalised intro email
  const draftBody = await completeText(
    `You are drafting a short, warm beat placement email from a music producer to an artist or their management.
Keep it under 150 words. Be genuine, mention the specific beat and why it fits the artist.
No hard sell. Professional but personable. Include the producer's name if available.
Sign off with just the producer's name.`,
    `Producer: ${process.env.PRODUCER_NAME ?? "the producer"}
Artist: ${artist.name} (${artist.genre})
Why they fit: ${artist.why_good_fit}
Beat: "${beat.title}" — ${beat.genre}, ${(beat.mood_tags ?? []).join(", ")}, ${beat.bpm ?? "?"}bpm
${managerName ? `Addressing: ${managerName} (manager)` : "Addressing the artist directly"}
Lease price: £${beat.license_tiers?.lease ?? 500}`
  );

  const toAddress = email ?? `${artist.name.toLowerCase().replace(/\s+/g, "")}@placeholder.com`;
  const hasRealEmail = !!email;

  await createDraft({
    pillar: "outreach",
    related_id: beat.id,
    to_address: toAddress,
    subject: `Beat placement — "${beat.title}" for ${artist.name}`,
    body: draftBody,
    reasoning: [
      `Scout found ${artist.name} via web search`,
      `Fit: ${artist.why_good_fit}`,
      `Contact: ${managerName ?? "direct"} — ${email ?? "no email found"}`,
      hasRealEmail ? "" : "⚠️ No real email found — placeholder address used. EDIT with real contact before approving.",
      `Source: ${artist.source_url ?? "Brave Search"}`,
    ].filter(Boolean).join("\n"),
    whatsappCard: {
      headline: `Outreach → ${artist.name}`,
      lines: [
        `Beat: "${beat.title}" (${beat.genre})`,
        `Fit: ${artist.why_good_fit}`,
        managerName ? `Via: ${managerName}` : "Direct to artist",
        hasRealEmail ? `Email: ${email}` : "⚠️ No email found — needs manual",
      ],
      warning: hasRealEmail ? undefined : "No verified email — EDIT before approving",
    },
  });

  await logAction({
    pillar: "outreach",
    trigger: "scout",
    action_taken: `Draft ready: "${beat.title}" → ${artist.name}${hasRealEmail ? "" : " (no email)"}`,
    channel: "internal",
  });
}

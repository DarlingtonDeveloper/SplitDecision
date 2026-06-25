/**
 * Web search module — Brave Search API.
 * Used by the outreach scout to find artists matching beat attributes
 * and discover their management contact info.
 *
 * Brave Search API: https://brave.com/search/api/
 * Free tier: 2,000 queries/month
 */

interface SearchResult {
  title: string;
  url: string;
  description: string;
}

/**
 * Search the web via Brave Search API.
 * Returns up to `count` results (default 5).
 */
export async function webSearch(query: string, count = 5): Promise<SearchResult[]> {
  const apiKey = process.env.BRAVE_SEARCH_API_KEY;
  if (!apiKey) {
    console.warn("[search] Missing BRAVE_SEARCH_API_KEY — returning empty results");
    return [];
  }

  const url = new URL("https://api.search.brave.com/res/v1/web/search");
  url.searchParams.set("q", query);
  url.searchParams.set("count", String(count));
  url.searchParams.set("search_lang", "en");

  const res = await fetch(url.toString(), {
    headers: {
      "Accept": "application/json",
      "Accept-Encoding": "gzip",
      "X-Subscription-Token": apiKey,
    },
  });

  if (!res.ok) {
    console.error(`[search] Brave API ${res.status}: ${await res.text()}`);
    return [];
  }

  const data = (await res.json()) as {
    web?: { results?: { title: string; url: string; description: string }[] };
  };

  return (data.web?.results ?? []).map((r) => ({
    title: r.title,
    url: r.url,
    description: r.description,
  }));
}

/**
 * Search for artists that match a beat's attributes.
 * Builds a targeted query from genre, mood, and reference artists.
 */
export async function searchForArtists(beat: {
  genre?: string | null;
  mood_tags?: string[] | null;
  reference_artists?: string[] | null;
}): Promise<SearchResult[]> {
  const parts: string[] = [];

  if (beat.reference_artists?.length) {
    parts.push(`artists similar to ${beat.reference_artists.join(", ")}`);
  }
  if (beat.genre) {
    parts.push(beat.genre);
  }
  if (beat.mood_tags?.length) {
    parts.push(beat.mood_tags.slice(0, 3).join(" "));
  }

  parts.push("emerging artist 2025 2026");

  const query = parts.join(" ") + " music";
  return webSearch(query, 10);
}

/**
 * Search for an artist's management/booking contact info.
 */
export async function searchForContact(artistName: string): Promise<SearchResult[]> {
  return webSearch(`"${artistName}" manager email contact booking management`, 5);
}

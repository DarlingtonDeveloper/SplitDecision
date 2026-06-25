import { getSupabaseAdmin } from "./supabase";

export async function nextShortCode(): Promise<string> {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from("drafts")
    .select("short_code")
    .order("created_at", { ascending: false })
    .limit(50);

  let max = 0;
  for (const row of data ?? []) {
    const match = /^A(\d+)$/i.exec(row.short_code ?? "");
    if (match) max = Math.max(max, parseInt(match[1], 10));
  }

  return `A${max + 1}`;
}

import { getSupabaseAdmin } from "./supabase";
import type { Pillar } from "./types";

export async function logAction(input: {
  pillar?: Pillar | string;
  trigger?: string;
  action_taken: string;
  channel?: string;
  is_autonomous?: boolean;
  draft_short_code?: string;
}) {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("actions").insert({
    pillar: input.pillar ?? null,
    trigger: input.trigger ?? null,
    action_taken: input.action_taken,
    channel: input.channel ?? null,
    is_autonomous: input.is_autonomous ?? true,
    draft_short_code: input.draft_short_code ?? null,
  });

  if (error) console.error("[actions] insert failed:", error.message);
}

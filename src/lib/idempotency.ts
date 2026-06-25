const seen = new Map<string, number>();
const TTL_MS = 10 * 60 * 1000;

function prune() {
  const now = Date.now();
  for (const [id, ts] of seen) {
    if (now - ts > TTL_MS) seen.delete(id);
  }
}

export function isDuplicateMessage(messageId: string): boolean {
  prune();
  if (seen.has(messageId)) return true;
  seen.set(messageId, Date.now());
  return false;
}

export async function isDuplicateMessagePersistent(
  messageId: string
): Promise<boolean> {
  try {
    const { getSupabaseAdmin } = await import("./supabase");
    const supabase = getSupabaseAdmin();
    const { data } = await supabase
      .from("seen_messages")
      .select("message_id")
      .eq("message_id", messageId)
      .maybeSingle();

    if (data) return true;

    await supabase.from("seen_messages").insert({ message_id: messageId });
    return false;
  } catch {
    return isDuplicateMessage(messageId);
  }
}

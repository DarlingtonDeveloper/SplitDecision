export interface InboundMessage {
  from: string;
  body: string;
  message_id: string;
}

function pickString(obj: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const val = obj[key];
    if (typeof val === "string" && val.trim()) return val.trim();
  }
  return null;
}

function dig(obj: unknown, path: string[]): unknown {
  let cur: unknown = obj;
  for (const p of path) {
    if (!cur || typeof cur !== "object") return null;
    cur = (cur as Record<string, unknown>)[p];
  }
  return cur;
}

/** Normalise Wassist (or similar) webhook payloads into a common shape. */
export function normalizeInbound(payload: unknown): InboundMessage | null {
  if (!payload || typeof payload !== "object") return null;
  const root = payload as Record<string, unknown>;
  const data = (root.data ?? root.message ?? root) as Record<string, unknown>;

  const from =
    pickString(data, ["from", "sender", "phone", "wa_id", "from_number"]) ??
    pickString(root, ["from", "sender", "phone"]) ??
    (typeof dig(data, ["contact", "wa_id"]) === "string"
      ? (dig(data, ["contact", "wa_id"]) as string)
      : null);

  const body =
    pickString(data, ["body", "text", "message", "content"]) ??
    pickString(root, ["body", "text", "message"]) ??
    (typeof dig(data, ["text", "body"]) === "string"
      ? (dig(data, ["text", "body"]) as string)
      : null);

  const message_id =
    pickString(data, ["id", "message_id", "messageId", "wamid"]) ??
    pickString(root, ["id", "message_id", "messageId"]) ??
    `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  if (!from || !body) return null;
  return { from, body, message_id };
}

export async function sendWhatsApp(to: string, body: string): Promise<string> {
  const url = process.env.WASSIST_SEND_URL;
  const apiKey = process.env.WASSIST_API_KEY;
  const headerName = process.env.WASSIST_AUTH_HEADER ?? "Authorization";

  if (!url || !apiKey) {
    console.warn("[whatsapp] Missing WASSIST env — logging instead:", { to, body });
    return `mock-${Date.now()}`;
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    [headerName]: headerName.toLowerCase() === "authorization" ? `Bearer ${apiKey}` : apiKey,
  };

  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({ to, body, message: body, text: body }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Wassist send failed (${res.status}): ${err}`);
  }

  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return (
    pickString(json, ["message_id", "id", "messageId"]) ?? `sent-${Date.now()}`
  );
}

export function formatDraftCard(input: {
  shortCode: string;
  pillar: string;
  headline: string;
  lines: string[];
  warning?: string;
}): string {
  const { shortCode, pillar, headline, lines, warning } = input;
  const parts = [
    `🎛️ DRAFT #${shortCode} · ${pillar}`,
    headline,
    ...lines,
    warning ? `⚠️ ${warning}` : null,
    "",
    `OK ${shortCode}   ·   EDIT ${shortCode} <note>   ·   NO ${shortCode}   ·   WHY ${shortCode}`,
  ].filter(Boolean);

  return parts.join("\n");
}

export function formatSentConfirmation(input: {
  shortCode: string;
  to: string;
  extra?: string;
}): string {
  const { shortCode, to, extra } = input;
  return [`✅ SENT #${shortCode} → ${to}`, extra, "I'll ping you when they reply."]
    .filter(Boolean)
    .join("\n");
}

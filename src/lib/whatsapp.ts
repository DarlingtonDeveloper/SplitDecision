// Wassist adapter — confirmed against https://docs.wassist.app
//   Base URL : https://backend.wassist.app/api/v1/
//   Auth     : X-API-Key header
//   Send     : POST /conversations/{id}/messages/
//   Buttons  : unified.buttons[] with type "quick_reply" (taps come back via webhook)
//              cta type for a single tappable URL button (PayPal link)
//
// Sends are conversation-scoped and only work on ACTIVE conversations
// (inside the 24h window). For the demo, have the producer message the
// agent once to open the conversation, then store that conversation id as
// WASSIST_PRODUCER_CONVERSATION_ID.

const BASE = "https://backend.wassist.app/api/v1";

function getKey() {
  const key = process.env.WASSIST_API_KEY;
  if (!key) throw new Error("Missing WASSIST_API_KEY");
  return key;
}

function getProducerConv() {
  const id = process.env.WASSIST_PRODUCER_CONVERSATION_ID;
  if (!id) throw new Error("Missing WASSIST_PRODUCER_CONVERSATION_ID");
  return id;
}

type QuickReply = { id: string; text: string }; // text max 20 chars

async function post(path: string, body: unknown) {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "X-API-Key": getKey(), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Wassist ${res.status}: ${err}`);
  }
  return res.json();
}

/** Plain text into a conversation. */
export function sendText(conversationId: string, body: string) {
  return post(`/conversations/${conversationId}/messages/`, {
    type: "text",
    text: { body },
  });
}

/** Text + tappable quick-reply buttons. Taps return via the inbound webhook. */
export function sendButtons(
  conversationId: string,
  text: string,
  buttons: QuickReply[],
  footer?: string,
) {
  return post(`/conversations/${conversationId}/messages/`, {
    type: "unified",
    unified: {
      text,
      footer,
      buttons: buttons.map((b) => ({
        type: "quick_reply",
        text: b.text.slice(0, 20),
        quickReplyId: b.id,
      })),
    },
  });
}

/** A single tappable link button (use for the PayPal lease link). */
export function sendCta(
  conversationId: string,
  body: string,
  buttonText: string,
  url: string,
) {
  return post(`/conversations/${conversationId}/messages/`, {
    type: "cta",
    cta: { body, buttonText: buttonText.slice(0, 20), url },
  });
}

// ---- Producer-facing helpers ------------------------------------------------

/** Send an approval card with tap buttons to the producer. */
export function notifyDraft(opts: {
  shortCode: string;
  pillar: string;
  summary: string;
  flag?: string;
}) {
  const { shortCode, pillar, summary, flag } = opts;
  const text =
    `🎛️ DRAFT #${shortCode} · ${pillar}\n\n${summary}` +
    (flag ? `\n\n⚠️ ${flag}` : "");
  return sendButtons(
    getProducerConv(),
    text,
    [
      { id: `OK:${shortCode}`, text: "Approve" },
      { id: `NO:${shortCode}`, text: "Reject" },
      { id: `WHY:${shortCode}`, text: "Why this?" },
    ],
    `Tap a button or reply OK / NO / WHY ${shortCode}`,
  );
}

/** Confirmation after a draft is approved and sent. */
export function notifySent(shortCode: string, to: string, paymentLink?: string) {
  const conv = getProducerConv();
  const msg = `✅ SENT #${shortCode} → ${to}\nI'll ping you when they reply.`;

  if (paymentLink) {
    return sendCta(conv, msg, "View lease link", paymentLink);
  }
  return sendText(conv, msg);
}

/**
 * Backward-compat wrapper — sends plain text to the producer conversation.
 * Used by command-handler and paypal webhook for simple replies.
 */
export async function sendWhatsApp(_to: string, body: string): Promise<string> {
  try {
    const conv = getProducerConv();
    const result = await sendText(conv, body);
    return result?.id ?? `sent-${Date.now()}`;
  } catch (e) {
    console.warn("[whatsapp] Send failed, logging instead:", e, { body });
    return `mock-${Date.now()}`;
  }
}

// ---- Inbound normalization --------------------------------------------------

export interface InboundMessage {
  from: string;
  body: string;
  message_id: string;
  conversationId: string;
}

/**
 * Normalise Wassist webhook payload into a common shape.
 * Handles both quick-reply button taps and free-text messages.
 *
 * Wassist webhook payloads come in event wrappers:
 *   { "event": "message.received", "data": { "message": {...}, "conversation": {...}, "contact": {...} } }
 * Or possibly flat (just the message object).
 *
 * Message shapes (from Wassist API):
 *   Text:       { "id": "...", "type": "text", "text": { "body": "Hello" } }
 *   Quick-reply: { "id": "...", "type": "quick_reply", "quickReply": { "text": "Approve", "quickReplyId": "OK:A1" } }
 */
export function normalizeInbound(payload: unknown): InboundMessage | null {
  if (!payload || typeof payload !== "object") return null;
  const root = payload as Record<string, unknown>;

  // Unwrap event envelope if present: { event, data: { message, conversation, contact } }
  const data = (root.data && typeof root.data === "object" ? root.data : root) as Record<string, unknown>;
  const message = (data.message && typeof data.message === "object" ? data.message : data) as Record<string, unknown>;

  // Message ID
  const messageId = pick(message, ["id", "message_id", "messageId"]) ?? pick(root, ["id"]);
  if (!messageId) return null;

  // Conversation ID — from envelope or fallback to producer conv
  const conversationId =
    pick(data, ["conversationId"]) ??
    deepPick(data, ["conversation", "id"]) ??
    pick(root, ["conversationId"]) ??
    deepPick(root, ["conversation", "id"]);

  // Quick-reply button tap: quickReply.quickReplyId (e.g. "OK:A1")
  const quickReplyId = deepPick(message, ["quickReply", "quickReplyId"]);

  // Free-text message: text.body (e.g. "OK A1")
  const textBody = deepPick(message, ["text", "body"]);

  // Fallback: bare body/text field
  const bareBody = pick(message, ["body", "text", "content"]);

  const raw = quickReplyId ?? textBody ?? bareBody;
  if (!raw) return null;

  // Contact info
  const from =
    pick(message, ["from", "sender", "phone", "wa_id"]) ??
    deepPick(data, ["contact", "phoneNumber"]) ??
    deepPick(data, ["contact", "wa_id"]) ??
    pick(root, ["from", "sender", "phone"]);

  // "OK:A3" (button) or "OK A3" (typed) -> normalize
  const body = String(raw).replace(":", " ").trim();

  return {
    from: from ?? "unknown",
    body,
    message_id: String(messageId),
    conversationId: conversationId ? String(conversationId) : getProducerConv(),
  };
}

// ---- helpers ----------------------------------------------------------------

function pick(obj: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const val = obj[key];
    if (typeof val === "string" && val.trim()) return val.trim();
  }
  return null;
}

function deepPick(obj: unknown, path: string[]): string | null {
  let cur: unknown = obj;
  for (const p of path) {
    if (!cur || typeof cur !== "object") return null;
    cur = (cur as Record<string, unknown>)[p];
  }
  return typeof cur === "string" && cur.trim() ? cur.trim() : null;
}

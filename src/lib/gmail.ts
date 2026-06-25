import { google, gmail_v1 } from "googleapis";
import { createTransport } from "nodemailer";

// ---- Auth -------------------------------------------------------------------

function getOAuth2Client() {
  const clientId = process.env.GMAIL_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GMAIL_OAUTH_CLIENT_SECRET;
  const refreshToken = process.env.GMAIL_OAUTH_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) return null;

  const oauth2 = new google.auth.OAuth2(clientId, clientSecret);
  oauth2.setCredentials({ refresh_token: refreshToken });
  return oauth2;
}

let gmailClient: gmail_v1.Gmail | null = null;

function getGmail(): gmail_v1.Gmail | null {
  if (gmailClient) return gmailClient;
  const auth = getOAuth2Client();
  if (!auth) return null;
  gmailClient = google.gmail({ version: "v1", auth });
  return gmailClient;
}

// ---- Inbound ----------------------------------------------------------------

export interface GmailMessage {
  id: string;           // Gmail message id
  threadId: string;     // Gmail thread id
  messageIdHeader: string; // RFC Message-ID header
  from: string;
  subject: string;
  body: string;         // stripped plain text
  rawBody: string;      // full body before stripping
  date: string;
}

/** List unread messages in INBOX. Returns Gmail message ids. */
export async function listUnread(maxResults = 10): Promise<string[]> {
  const gmail = getGmail();
  if (!gmail) return [];

  const res = await gmail.users.messages.list({
    userId: "me",
    q: "is:unread in:inbox",
    maxResults,
  });

  return (res.data.messages ?? []).map((m) => m.id!).filter(Boolean);
}

/** Fetch a full message by id. */
export async function fetchMessage(messageId: string): Promise<GmailMessage | null> {
  const gmail = getGmail();
  if (!gmail) return null;

  const res = await gmail.users.messages.get({
    userId: "me",
    id: messageId,
    format: "full",
  });

  const msg = res.data;
  const headers = msg.payload?.headers ?? [];

  const getHeader = (name: string) =>
    headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ?? "";

  const rawBody = extractBody(msg.payload);
  const body = stripQuotedHistory(rawBody);

  return {
    id: msg.id!,
    threadId: msg.threadId!,
    messageIdHeader: getHeader("Message-ID") || getHeader("Message-Id"),
    from: getHeader("From"),
    subject: getHeader("Subject"),
    body,
    rawBody,
    date: getHeader("Date"),
  };
}

/** Mark a message as read. */
export async function markRead(messageId: string): Promise<void> {
  const gmail = getGmail();
  if (!gmail) return;

  await gmail.users.messages.modify({
    userId: "me",
    id: messageId,
    requestBody: { removeLabelIds: ["UNREAD"] },
  });
}

// ---- Outbound ---------------------------------------------------------------

export async function sendEmail(opts: {
  to: string;
  subject: string;
  body: string;
  threadId?: string;
  inReplyToMessageId?: string;
  paymentLink?: string;
}): Promise<{ id?: string; threadId?: string }> {
  const { to, subject, body, threadId, inReplyToMessageId, paymentLink } = opts;

  const fullBody = paymentLink
    ? `${body}\n\nLicense + secure payment: ${paymentLink}`
    : body;

  // Try Gmail API first
  const gmail = getGmail();
  if (gmail) {
    return sendViaGmailApi(gmail, { to, subject, body: fullBody, threadId, inReplyToMessageId });
  }

  // Fallback: nodemailer over SMTP (Gmail app password)
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_APP_PASSWORD ?? process.env.SMTP_PASS;
  if (smtpUser && smtpPass) {
    return sendViaSmtp({ to, subject, body: fullBody, inReplyToMessageId, smtpUser, smtpPass });
  }

  // Fallback: SendGrid
  const sendgridKey = process.env.SENDGRID_API_KEY;
  if (sendgridKey) {
    return sendViaSendGrid({ to, subject, body: fullBody, sendgridKey });
  }

  // Last resort: log
  console.warn("[email] No send provider configured — logging:", { to, subject });
  return {};
}

async function sendViaGmailApi(
  gmail: gmail_v1.Gmail,
  opts: { to: string; subject: string; body: string; threadId?: string; inReplyToMessageId?: string },
): Promise<{ id?: string; threadId?: string }> {
  const from = process.env.GMAIL_AGENT_ADDRESS ?? "me";
  const headers = [
    `From: ${from}`,
    `To: ${opts.to}`,
    `Subject: ${opts.subject}`,
    "Content-Type: text/plain; charset=UTF-8",
    opts.inReplyToMessageId ? `In-Reply-To: ${opts.inReplyToMessageId}` : "",
    opts.inReplyToMessageId ? `References: ${opts.inReplyToMessageId}` : "",
  ].filter(Boolean).join("\r\n");

  const raw = Buffer.from(`${headers}\r\n\r\n${opts.body}`).toString("base64url");

  const res = await gmail.users.messages.send({
    userId: "me",
    requestBody: { raw, threadId: opts.threadId },
  });

  return { id: res.data.id ?? undefined, threadId: res.data.threadId ?? undefined };
}

async function sendViaSmtp(opts: {
  to: string;
  subject: string;
  body: string;
  inReplyToMessageId?: string;
  smtpUser: string;
  smtpPass: string;
}): Promise<{ id?: string }> {
  const transport = createTransport({
    host: process.env.SMTP_HOST ?? "smtp.gmail.com",
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: false,
    auth: { user: opts.smtpUser, pass: opts.smtpPass },
  });

  const mailHeaders: Record<string, string> = {};
  if (opts.inReplyToMessageId) {
    mailHeaders["In-Reply-To"] = opts.inReplyToMessageId;
    mailHeaders["References"] = opts.inReplyToMessageId;
  }

  const info = await transport.sendMail({
    from: process.env.SMTP_FROM ?? opts.smtpUser,
    to: opts.to,
    subject: opts.subject,
    text: opts.body,
    headers: mailHeaders,
  });

  return { id: info.messageId };
}

async function sendViaSendGrid(opts: {
  to: string;
  subject: string;
  body: string;
  sendgridKey: string;
}): Promise<{}> {
  const from = process.env.SMTP_FROM ?? process.env.GMAIL_AGENT_ADDRESS ?? "agent@splitdecision.app";
  const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${opts.sendgridKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: opts.to }] }],
      from: { email: from },
      subject: opts.subject,
      content: [{ type: "text/plain", value: opts.body }],
    }),
  });
  if (!res.ok) throw new Error(`SendGrid failed: ${await res.text()}`);
  return {};
}

// ---- Helpers ----------------------------------------------------------------

/** Extract plain text body from Gmail payload (handles multipart). */
function extractBody(payload: gmail_v1.Schema$MessagePart | undefined): string {
  if (!payload) return "";

  // Direct body
  if (payload.mimeType === "text/plain" && payload.body?.data) {
    return Buffer.from(payload.body.data, "base64url").toString("utf-8");
  }

  // Multipart — find text/plain first, then text/html
  if (payload.parts) {
    const plain = payload.parts.find((p) => p.mimeType === "text/plain");
    if (plain?.body?.data) {
      return Buffer.from(plain.body.data, "base64url").toString("utf-8");
    }

    const html = payload.parts.find((p) => p.mimeType === "text/html");
    if (html?.body?.data) {
      const raw = Buffer.from(html.body.data, "base64url").toString("utf-8");
      return stripHtml(raw);
    }

    // Nested multipart
    for (const part of payload.parts) {
      const result = extractBody(part);
      if (result) return result;
    }
  }

  return "";
}

/** Strip HTML tags to plain text. */
function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Strip quoted history from an email body. Keep only the new content. */
function stripQuotedHistory(body: string): string {
  const lines = body.split("\n");
  const cutPatterns = [
    /^On .+ wrote:$/,
    /^-{3,}\s*Original Message\s*-{3,}$/i,
    /^>{2,}/,           // multiple consecutive quote markers
    /^-- $/,            // signature marker
    /^Sent from my /i,
  ];

  let cutIndex = lines.length;
  for (let i = 0; i < lines.length; i++) {
    if (cutPatterns.some((p) => p.test(lines[i].trim()))) {
      cutIndex = i;
      break;
    }
    // Run of > lines (quoted text)
    if (lines[i].startsWith(">") && i + 1 < lines.length && lines[i + 1].startsWith(">")) {
      cutIndex = i;
      break;
    }
  }

  return lines.slice(0, cutIndex).join("\n").trim();
}

/** Check if Gmail API is configured. */
export function isGmailConfigured(): boolean {
  return !!(
    process.env.GMAIL_OAUTH_CLIENT_ID &&
    process.env.GMAIL_OAUTH_CLIENT_SECRET &&
    process.env.GMAIL_OAUTH_REFRESH_TOKEN
  );
}

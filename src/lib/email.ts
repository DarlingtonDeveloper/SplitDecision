export async function sendEmail(input: {
  to: string;
  subject: string;
  body: string;
}): Promise<void> {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM ?? user;

  if (!host || !user || !pass) {
    console.warn("[email] SMTP not configured — logging outbound:", input);
    return;
  }

  // Minimal SMTP via fetch to a relay if available, else log for demo
  // For hackathon: many teams use Resend/SendGrid; keep a simple fetch path.
  const sendgridKey = process.env.SENDGRID_API_KEY;
  if (sendgridKey) {
    const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${sendgridKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: input.to }] }],
        from: { email: from! },
        subject: input.subject,
        content: [{ type: "text/plain", value: input.body }],
      }),
    });
    if (!res.ok) throw new Error(`SendGrid failed: ${await res.text()}`);
    return;
  }

  console.log("[email] would send", { from, ...input, host, user: "***" });
}

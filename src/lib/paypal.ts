const PAYPAL_BASE =
  process.env.PAYPAL_ENV === "live"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";

async function getAccessToken(): Promise<string> {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const secret = process.env.PAYPAL_SECRET;
  if (!clientId || !secret) throw new Error("Missing PayPal credentials");

  const auth = Buffer.from(`${clientId}:${secret}`).toString("base64");
  const res = await fetch(`${PAYPAL_BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  if (!res.ok) throw new Error(`PayPal auth failed: ${await res.text()}`);
  const { access_token } = (await res.json()) as { access_token: string };
  return access_token;
}

export async function createPayPalOrder(input: {
  amount: number;
  currency?: string;
  description: string;
  beatId?: string;
}): Promise<{ orderId: string; approvalUrl: string }> {
  const token = await getAccessToken();
  const currency = input.currency ?? "GBP";
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

  const res = await fetch(`${PAYPAL_BASE}/v2/checkout/orders`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      intent: "CAPTURE",
      purchase_units: [
        {
          description: input.description,
          custom_id: input.beatId,
          amount: {
            currency_code: currency,
            value: input.amount.toFixed(2),
          },
        },
      ],
      application_context: {
        return_url: `${appUrl}/api/paypal/return`,
        cancel_url: `${appUrl}/api/paypal/cancel`,
      },
    }),
  });

  if (!res.ok) throw new Error(`PayPal order failed: ${await res.text()}`);
  const order = (await res.json()) as {
    id: string;
    links: { rel: string; href: string }[];
  };

  const approvalUrl =
    order.links.find((l) => l.rel === "approve")?.href ??
    order.links.find((l) => l.rel === "payer-action")?.href;

  if (!approvalUrl) throw new Error("No PayPal approval URL");

  return { orderId: order.id, approvalUrl };
}

export async function capturePayPalOrder(orderId: string): Promise<void> {
  const token = await getAccessToken();
  const res = await fetch(`${PAYPAL_BASE}/v2/checkout/orders/${orderId}/capture`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });
  if (!res.ok) throw new Error(`PayPal capture failed: ${await res.text()}`);
}

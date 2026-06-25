import { NextRequest, NextResponse } from "next/server";
import { logAction } from "@/lib/actions";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const orderId = url.searchParams.get("token") ?? url.searchParams.get("order");
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? url.origin;

  if (orderId) {
    await logAction({
      pillar: "negotiation",
      trigger: "paypal_cancel",
      action_taken: `PayPal checkout cancelled: ${orderId}`,
      channel: "paypal",
    });
  }

  return NextResponse.redirect(
    `${appUrl}/?payment=cancelled${orderId ? `&order=${encodeURIComponent(orderId)}` : ""}`,
  );
}

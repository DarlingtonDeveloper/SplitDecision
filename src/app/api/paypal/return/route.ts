import { NextRequest, NextResponse } from "next/server";
import { logAction } from "@/lib/actions";
import { capturePayPalOrder } from "@/lib/paypal";
import { getSupabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const orderId = url.searchParams.get("token");
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? url.origin;

  if (!orderId) {
    return NextResponse.redirect(`${appUrl}/?payment=missing_order`);
  }

  try {
    const capture = await capturePayPalOrder(orderId);
    const purchaseUnit = capture.purchase_units?.[0];
    const captureStatus = purchaseUnit?.payments?.captures?.[0]?.status ?? capture.status ?? "captured";
    const amount = purchaseUnit?.amount?.value ?? purchaseUnit?.payments?.captures?.[0]?.amount?.value;

    const supabase = getSupabaseAdmin();
    await supabase
      .from("sales")
      .update({ status: captureStatus.toLowerCase() })
      .eq("paypal_order_id", orderId);

    await logAction({
      pillar: "negotiation",
      trigger: "paypal_return",
      action_taken: `PayPal order captured: ${amount ? `£${amount}` : orderId}`,
      channel: "paypal",
    });

    return NextResponse.redirect(`${appUrl}/?payment=success&order=${encodeURIComponent(orderId)}`);
  } catch (error) {
    console.error("[paypal:return] capture failed", error);
    await logAction({
      pillar: "negotiation",
      trigger: "paypal_return_error",
      action_taken: `PayPal capture failed for ${orderId}`,
      channel: "paypal",
    });
    return NextResponse.redirect(`${appUrl}/?payment=error&order=${encodeURIComponent(orderId)}`);
  }
}

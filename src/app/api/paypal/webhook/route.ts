import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { logAction } from "@/lib/actions";
import { sendWhatsApp } from "@/lib/whatsapp";
import { getProducerWhatsApp } from "@/lib/config";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const payload = await req.json();
  const eventType = payload.event_type as string | undefined;
  const resource = payload.resource ?? {};

  if (eventType === "CHECKOUT.ORDER.APPROVED" || eventType === "PAYMENT.CAPTURE.COMPLETED") {
    const orderId = resource.id ?? resource.supplementary_data?.related_ids?.order_id;
    const amount = resource.amount?.value ?? resource.purchase_units?.[0]?.amount?.value;

    if (orderId) {
      const supabase = getSupabaseAdmin();
      await supabase
        .from("sales")
        .update({ status: "captured" })
        .eq("paypal_order_id", orderId);

      await logAction({
        pillar: "negotiation",
        trigger: "paypal_webhook",
        action_taken: `Sale captured: £${amount ?? "?"}`,
        channel: "paypal",
      });

      try {
        await sendWhatsApp(
          getProducerWhatsApp(),
          `💰 Sale captured — £${amount ?? "?"} (order ${orderId})`
        );
      } catch {
        /* demo continues */
      }
    }
  }

  return NextResponse.json({ ok: true });
}

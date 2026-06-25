import { NextRequest, NextResponse } from "next/server";
import { createPayPalOrder } from "@/lib/paypal";
import { getSupabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const { beat_id, tier, amount } = (await req.json()) as {
    beat_id?: string;
    tier?: string;
    amount?: number;
  };

  if (!amount) {
    return NextResponse.json({ error: "amount required" }, { status: 400 });
  }

  const order = await createPayPalOrder({
    amount,
    description: `Beat ${tier ?? "lease"}`,
    beatId: beat_id,
  });

  if (beat_id) {
    const supabase = getSupabaseAdmin();
    await supabase.from("sales").insert({
      beat_id,
      tier: tier ?? "lease",
      paypal_order_id: order.orderId,
      amount,
      status: "created",
    });
  }

  return NextResponse.json(order);
}

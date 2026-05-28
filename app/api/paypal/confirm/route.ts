import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSubscription } from "@/lib/paypal";

export const dynamic = "force-dynamic";

// Called by the frontend immediately after the user approves a PayPal
// subscription. Verifies with PayPal and flips the user to Plus right away
// so they don't have to wait for the webhook to land.
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let subscriptionId: string;
  try {
    const body = (await req.json()) as { subscriptionId?: string };
    if (!body.subscriptionId || typeof body.subscriptionId !== "string") {
      return NextResponse.json({ error: "bad_request" }, { status: 400 });
    }
    subscriptionId = body.subscriptionId;
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  let sub;
  try {
    sub = await getSubscription(subscriptionId);
  } catch (e) {
    console.error("[paypal/confirm] fetch failed:", e);
    return NextResponse.json({ error: "verify_failed" }, { status: 502 });
  }

  // Guard: the subscription's custom_id must match this user, so a hostile
  // client can't activate Plus for themselves using someone else's sub.
  if (sub.custom_id && sub.custom_id !== user.id) {
    return NextResponse.json({ error: "owner_mismatch" }, { status: 403 });
  }

  const active = sub.status === "ACTIVE" || sub.status === "APPROVED";
  if (!active) {
    return NextResponse.json(
      { error: `Subscription is ${sub.status}` },
      { status: 400 },
    );
  }

  const renewsAt = sub.billing_info?.next_billing_time ?? null;
  const { error } = await supabase
    .from("profiles")
    .update({
      subscription_tier: "plus",
      paypal_subscription_id: sub.id,
      subscription_renews_at: renewsAt,
      payment_provider: "paypal",
    })
    .eq("id", user.id);
  if (error) {
    console.error("[paypal/confirm] update failed:", error);
    return NextResponse.json({ error: "persist_failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

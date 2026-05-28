import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyWebhookSignature, getSubscription } from "@/lib/paypal";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type WebhookEvent = {
  id: string;
  event_type: string;
  resource: {
    id?: string;
    status?: string;
    custom_id?: string;
    billing_info?: { next_billing_time?: string };
  };
};

async function findUserId(
  resource: WebhookEvent["resource"],
): Promise<string | null> {
  if (resource.custom_id) return resource.custom_id;
  if (!resource.id) return null;
  const admin = createAdminClient();
  const { data } = await admin
    .from("profiles")
    .select("id")
    .eq("paypal_subscription_id", resource.id)
    .maybeSingle();
  return data?.id ?? null;
}

export async function POST(req: NextRequest) {
  const webhookId = process.env.PAYPAL_WEBHOOK_ID;
  if (!webhookId) {
    return NextResponse.json({ error: "not_configured" }, { status: 500 });
  }

  const headers = {
    transmissionId: req.headers.get("paypal-transmission-id") ?? "",
    transmissionTime: req.headers.get("paypal-transmission-time") ?? "",
    certUrl: req.headers.get("paypal-cert-url") ?? "",
    authAlgo: req.headers.get("paypal-auth-algo") ?? "",
    transmissionSig: req.headers.get("paypal-transmission-sig") ?? "",
  };
  if (Object.values(headers).some((v) => !v)) {
    return NextResponse.json({ error: "missing_headers" }, { status: 400 });
  }

  const raw = await req.text();
  let event: WebhookEvent;
  try {
    event = JSON.parse(raw) as WebhookEvent;
  } catch {
    return NextResponse.json({ error: "bad_json" }, { status: 400 });
  }

  const verified = await verifyWebhookSignature({
    ...headers,
    webhookId,
    body: event,
  });
  if (!verified) {
    console.error("[paypal/webhook] signature verification failed", event.id);
    return NextResponse.json({ error: "bad_signature" }, { status: 400 });
  }

  const userId = await findUserId(event.resource);
  if (!userId) {
    console.error("[paypal/webhook] no user_id for event", event.id);
    // Still return 200 so PayPal doesn't keep retrying.
    return NextResponse.json({ received: true });
  }

  const admin = createAdminClient();
  try {
    switch (event.event_type) {
      case "BILLING.SUBSCRIPTION.ACTIVATED":
      case "BILLING.SUBSCRIPTION.UPDATED": {
        // Re-fetch authoritative state from PayPal.
        const subId = event.resource.id;
        if (!subId) break;
        const sub = await getSubscription(subId);
        const active = sub.status === "ACTIVE";
        await admin
          .from("profiles")
          .update({
            subscription_tier: active ? "plus" : "free",
            paypal_subscription_id: sub.id,
            subscription_renews_at:
              sub.billing_info?.next_billing_time ?? null,
            payment_provider: active ? "paypal" : null,
          })
          .eq("id", userId);
        break;
      }
      case "BILLING.SUBSCRIPTION.CANCELLED":
      case "BILLING.SUBSCRIPTION.EXPIRED":
      case "BILLING.SUBSCRIPTION.SUSPENDED": {
        await admin
          .from("profiles")
          .update({
            subscription_tier: "free",
            subscription_renews_at: null,
            payment_provider: null,
          })
          .eq("id", userId);
        break;
      }
      default:
        break;
    }
  } catch (e) {
    console.error("[paypal/webhook] handler error:", e);
    return NextResponse.json({ error: "handler_error" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

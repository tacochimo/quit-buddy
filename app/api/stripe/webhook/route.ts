import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
// Stripe needs raw bytes for signature verification — disable body parsing.
export const runtime = "nodejs";

async function findUserIdForCustomer(
  customerId: string,
): Promise<string | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("profiles")
    .select("id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();
  return data?.id ?? null;
}

async function syncSubscription(sub: Stripe.Subscription, fallbackUserId?: string) {
  const customerId =
    typeof sub.customer === "string" ? sub.customer : sub.customer.id;
  const userId =
    fallbackUserId ??
    (sub.metadata?.user_id as string | undefined) ??
    (await findUserIdForCustomer(customerId));
  if (!userId) {
    console.error("[stripe] no user_id resolvable for subscription", sub.id);
    return;
  }

  const active = ["active", "trialing"].includes(sub.status);
  const tier = active ? "plus" : "free";
  const renewsAt = sub.current_period_end
    ? new Date(sub.current_period_end * 1000).toISOString()
    : null;

  const admin = createAdminClient();
  const { error } = await admin
    .from("profiles")
    .update({
      subscription_tier: tier,
      subscription_renews_at: renewsAt,
      stripe_customer_id: customerId,
      stripe_subscription_id: sub.id,
      payment_provider: active ? "stripe" : null,
    })
    .eq("id", userId);
  if (error) console.error("[stripe] profile update failed:", error);
}

export async function POST(req: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "not_configured" }, { status: 500 });
  }
  const sig = req.headers.get("stripe-signature");
  if (!sig) return NextResponse.json({ error: "no_signature" }, { status: 400 });

  const body = await req.text();
  const stripe = getStripe();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, secret);
  } catch (e) {
    console.error("[stripe] signature verification failed:", e);
    return NextResponse.json({ error: "bad_signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.client_reference_id ?? undefined;
        if (session.subscription) {
          const subId =
            typeof session.subscription === "string"
              ? session.subscription
              : session.subscription.id;
          const sub = await stripe.subscriptions.retrieve(subId);
          await syncSubscription(sub, userId);
        }
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        await syncSubscription(sub);
        break;
      }
      default:
        // No-op for unhandled events.
        break;
    }
  } catch (e) {
    console.error("[stripe] handler error:", e);
    return NextResponse.json({ error: "handler_error" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

import { headers } from "next/headers";
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createServiceClient } from "@/lib/supabase/service";
import { creditMonthlyQuotas, resolvePlanFromPrice, type BillingPlan } from "@/lib/billing/quotas";

const stripeSecret = process.env.STRIPE_SECRET_KEY;
const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

const stripe = stripeSecret ? new Stripe(stripeSecret, { apiVersion: "2023-10-16" }) : null;

async function handleCheckoutSessionCompleted(event: Stripe.Event, supabase = createServiceClient()) {
  const session = event.data.object as Stripe.Checkout.Session;
  const planId = (session.metadata?.plan_id as BillingPlan | undefined) ?? resolvePlanFromPrice(session.metadata?.price_id);
  const userId = (session.metadata?.user_id as string | undefined) ?? null;

  if (!planId || !userId) {
    console.warn("[stripe:webhook] missing planId or userId", { planId, userId });
    return;
  }

  const subscriptionId = typeof session.subscription === "string" ? session.subscription : session.subscription?.id ?? null;
  const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id ?? null;

  await supabase
    .from("profiles")
    .update({
      plan: planId,
      stripe_subscription_id: subscriptionId,
      stripe_customer_id: customerId,
    })
    .eq("id", userId);

  await creditMonthlyQuotas(supabase, userId, planId);

  await recordAffiliatePayout(supabase, userId, planId, session.amount_total ?? 0, subscriptionId);
}

async function handleInvoicePaid(event: Stripe.Event, supabase = createServiceClient()) {
  const invoice = event.data.object as Stripe.Invoice;
  const subscriptionId = typeof invoice.subscription === "string" ? invoice.subscription : invoice.subscription?.id ?? null;
  const priceId = invoice.lines.data[0]?.price?.id ?? null;
  const planId = resolvePlanFromPrice(priceId);

  if (!subscriptionId || !planId) {
    return;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("stripe_subscription_id", subscriptionId)
    .maybeSingle();

  if (!profile?.id) {
    return;
  }

  await supabase
    .from("profiles")
    .update({ plan: planId })
    .eq("id", profile.id);

  await creditMonthlyQuotas(supabase, profile.id, planId);
  await recordAffiliatePayout(supabase, profile.id, planId, invoice.amount_paid ?? 0, subscriptionId);
}

async function recordAffiliatePayout(
  supabase: ReturnType<typeof createServiceClient>,
  userId: string,
  planId: BillingPlan,
  amountTotal: number,
  subscriptionId: string | null
) {
  if (amountTotal <= 0) {
    return;
  }

  const { data: attribution } = await supabase
    .from("affiliate_attributions")
    .select("affiliate_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (!attribution?.affiliate_id) {
    return;
  }

  const { data: affiliate } = await supabase
    .from("affiliates")
    .select("rate_bps")
    .eq("id", attribution.affiliate_id)
    .maybeSingle();

  const rateBps = affiliate?.rate_bps ?? 1000;
  const amountCents = Math.round((amountTotal * rateBps) / 10000);

  const periodLabel = new Date().toISOString().slice(0, 7);
  await supabase.from("affiliate_payouts").insert({
    affiliate_id: attribution.affiliate_id,
    user_id: userId,
    subscription_id: subscriptionId,
    amount_cents: amountCents,
    amount: (amountCents / 100).toFixed(2),
    period: periodLabel,
    plan: planId,
    status: "due",
  });
}

export async function POST(request: Request) {
  if (!stripe || !stripeWebhookSecret) {
    return NextResponse.json({ error: "stripe_not_configured" }, { status: 500 });
  }

  const signature = headers().get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "signature_missing" }, { status: 400 });
  }

  const payload = await request.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(payload, signature, stripeWebhookSecret);
  } catch (error) {
    console.error("[stripe:webhook] invalid signature", error);
    return NextResponse.json({ error: "invalid_signature" }, { status: 400 });
  }

  try {
    if (event.type === "checkout.session.completed") {
      await handleCheckoutSessionCompleted(event);
    }

    if (event.type === "invoice.paid") {
      await handleInvoicePaid(event);
    }
  } catch (error) {
    console.error("[stripe:webhook] handler error", error);
    return NextResponse.json({ received: true, retriable: true }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

import Stripe from "stripe";
import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { PLAN_CONFIG, type BillingPlan } from "@/lib/billing/quotas";

type CheckoutPayload = {
  planId?: BillingPlan;
};

const stripeClient = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2023-10-16" })
  : null;

export async function POST(request: Request) {
  if (!stripeClient) {
    return NextResponse.json({ error: "stripe_not_configured" }, { status: 500 });
  }

  try {
    const body = (await request.json()) as CheckoutPayload;
    const targetPlan = body?.planId ?? "starter";

    if (!PLAN_CONFIG[targetPlan]) {
      return NextResponse.json({ error: "unknown_plan" }, { status: 400 });
    }

    const { client, accessToken } = createServerClient();
    if (!accessToken) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const { data, error } = await client.auth.getUser(accessToken);
    if (error || !data.user) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const { data: profile } = await client
      .from("profiles")
      .select("stripe_customer_id")
      .eq("id", data.user.id)
      .maybeSingle();

    const priceId = process.env[PLAN_CONFIG[targetPlan].priceIdEnv];
    if (!priceId) {
      return NextResponse.json({ error: "price_not_configured" }, { status: 500 });
    }

    const successUrlBase = process.env.NEXT_PUBLIC_SITE_URL;
    if (!successUrlBase) {
      return NextResponse.json({ error: "site_url_missing" }, { status: 500 });
    }

    const session = await stripeClient.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      customer: profile?.stripe_customer_id ?? undefined,
      customer_email: profile?.stripe_customer_id ? undefined : data.user.email ?? undefined,
      success_url: `${successUrlBase}/dashboard?welcome=1`,
      cancel_url: `${successUrlBase}/billing?canceled=1`,
      metadata: {
        plan_id: targetPlan,
        user_id: data.user.id,
        price_id: priceId,
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("[api/stripe/checkout]", error);
    return NextResponse.json({ error: "checkout_failed" }, { status: 500 });
  }
}

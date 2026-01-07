import Stripe from "npm:stripe@18";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) {
      return new Response(JSON.stringify({ error: "Stripe key not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });
    const { subscription_ids } = await req.json();

    if (!subscription_ids || !Array.isArray(subscription_ids)) {
      return new Response(JSON.stringify({ error: "subscription_ids array required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results = [];

    for (const subId of subscription_ids) {
      try {
        const subscription = await stripe.subscriptions.retrieve(subId, {
          expand: ["discount", "discount.coupon", "customer"],
        });

        const customer = subscription.customer as Stripe.Customer;
        
        results.push({
          subscription_id: subId,
          customer_email: customer?.email || "unknown",
          status: subscription.status,
          current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
          current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
          discount: subscription.discount ? {
            coupon_id: subscription.discount.coupon?.id,
            coupon_name: subscription.discount.coupon?.name,
            percent_off: subscription.discount.coupon?.percent_off,
            amount_off: subscription.discount.coupon?.amount_off,
            duration: subscription.discount.coupon?.duration,
            duration_in_months: subscription.discount.coupon?.duration_in_months,
            start: subscription.discount.start ? new Date(subscription.discount.start * 1000).toISOString() : null,
            end: subscription.discount.end ? new Date(subscription.discount.end * 1000).toISOString() : null,
          } : null,
        });
      } catch (err: unknown) {
        results.push({
          subscription_id: subId,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    console.log("Subscription discount check results:", JSON.stringify(results, null, 2));

    return new Response(JSON.stringify({ subscriptions: results }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("Error checking subscriptions:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

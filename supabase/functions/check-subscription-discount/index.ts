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

    const stripe = new Stripe(stripeKey);
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
        const subResponse = await stripe.subscriptions.retrieve(subId, {
          expand: ["discounts", "customer"],
        });
        const subscription = subResponse as unknown as {
          customer: Stripe.Customer;
          discounts?: Array<{ coupon?: { id?: string; name?: string; percent_off?: number; amount_off?: number; duration?: string; duration_in_months?: number }; start?: number; end?: number }>;
          status: string;
          current_period_start: number;
          current_period_end: number;
        };

        const customer = subscription.customer;
        const firstDiscount = subscription.discounts?.[0];
        const discountObj = typeof firstDiscount === 'object' ? firstDiscount : null;
        
        results.push({
          subscription_id: subId,
          customer_email: customer?.email || "unknown",
          status: subscription.status,
          current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
          current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
          discount: discountObj ? {
            coupon_id: discountObj.coupon?.id,
            coupon_name: discountObj.coupon?.name,
            percent_off: discountObj.coupon?.percent_off,
            amount_off: discountObj.coupon?.amount_off,
            duration: discountObj.coupon?.duration,
            duration_in_months: discountObj.coupon?.duration_in_months,
            start: discountObj.start ? new Date(discountObj.start * 1000).toISOString() : null,
            end: discountObj.end ? new Date(discountObj.end * 1000).toISOString() : null,
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

import Stripe from "https://esm.sh/stripe@18.5.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*", // TODO: restrict to frontend domain
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const jsonResponse = (payload: unknown, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ ok: false, error: "Method not allowed" }, 405);
  }

  try {
    const body = await req.json();
    const email = body?.email as string | undefined;

    console.log("[customer-portal] Incoming request", { email });

    if (!email) {
      console.error("[customer-portal] Email missing from payload");
      return jsonResponse({ ok: false, error: "Email requis pour le customer portal" }, 400);
    }

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) {
      console.error("[customer-portal] STRIPE_SECRET_KEY missing");
      return jsonResponse({ ok: false, error: "STRIPE_SECRET_KEY missing" }, 500);
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2024-11-20" });

    let customerId: string | undefined;
    const existing = await stripe.customers.list({ email, limit: 1 });
    if (existing.data.length > 0) {
      customerId = existing.data[0].id;
      console.log("[customer-portal] Found existing customer", { customerId });
    } else {
      const newCustomer = await stripe.customers.create({ email });
      customerId = newCustomer.id;
      console.log("[customer-portal] Created new customer", { customerId });
    }

    const returnUrl =
      Deno.env.get("FRONTEND_URL") ||
      Deno.env.get("SITE_URL") ||
      req.headers.get("origin") ||
      "http://localhost:3000";

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${returnUrl}/billing`,
    });

    console.log("[customer-portal] Customer portal session created", {
      sessionId: portalSession.id,
      url: portalSession.url,
    });

    return jsonResponse({ ok: true, url: portalSession.url });
  } catch (error: any) {
    console.error("[customer-portal] Error", error);
    return jsonResponse({ ok: false, error: error.message ?? "Unknown error" }, 500);
  }
});

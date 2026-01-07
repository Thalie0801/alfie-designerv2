import Stripe from "npm:stripe@18";
import { createClient } from "npm:@supabase/supabase-js@2";

import { corsHeaders } from "../_shared/cors.ts";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "../_shared/env.ts";

Deno.serve(async (req) => {
  console.log("purchase-credit-pack: request received", req.method);
  
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    SUPABASE_URL!,
    SUPABASE_ANON_KEY!
  );

  try {
    const { pack_id } = await req.json();
    
    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Not authenticated");
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: userData } = await supabaseClient.auth.getUser(token);
    const user = userData.user;
    
    if (!user?.email) {
      throw new Error("User email not available");
    }

    // Fetch pack details
    const { data: pack, error: packError } = await supabaseClient
      .from('credit_packs')
      .select('*')
      .eq('id', pack_id)
      .single();

    if (packError || !pack) {
      throw new Error("Pack not found");
    }

    // Check if user has Studio or Pro plan for discount
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('plan')
      .eq('id', user.id)
      .single();

    const isEligibleForDiscount = (profile?.plan === 'studio' || profile?.plan === 'pro') && pack.name === 'Pack 50 crédits';
    const finalPrice = isEligibleForDiscount 
      ? Math.round(pack.price_cents * (1 - pack.discount_percentage / 100))
      : pack.price_cents;

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    // Check if customer exists
    let customerId;
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
    }

    const origin = req.headers.get("origin") || "http://localhost:8080";
    
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'eur',
            product_data: {
              name: pack.name,
              description: `${pack.credits} crédits IA pour générer des visuels`,
            },
            unit_amount: finalPrice,
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${origin}/credit-purchase-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/billing?purchase=canceled`,
      metadata: {
        user_id: user.id,
        credits: pack.credits.toString(),
        pack_id: pack.id,
      },
    });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: any) {
    console.error("Error in purchase-credit-pack:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});

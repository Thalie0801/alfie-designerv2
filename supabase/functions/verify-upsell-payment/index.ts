import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { corsHeaders } from "../_shared/cors.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { sessionId, brandId } = await req.json();

    if (!sessionId) {
      return new Response(
        JSON.stringify({ success: false, error: "sessionId required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[verify-upsell-payment] Verifying session:", sessionId);

    const stripeSecret = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeSecret) {
      throw new Error("STRIPE_SECRET_KEY not configured");
    }

    const stripe = new Stripe(stripeSecret, {
      apiVersion: "2025-08-27.basil",
    });

    // Retrieve the checkout session
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["line_items", "customer"],
    });

    if (session.payment_status !== "paid") {
      return new Response(
        JSON.stringify({ success: false, error: "Payment not completed", status: session.payment_status }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[verify-upsell-payment] Payment verified:", {
      email: session.customer_email,
      amount: session.amount_total,
      metadata: session.metadata,
    });

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const userId = session.metadata?.supabase_user_id;
    const email = session.customer_email;
    const metaBrandId = session.metadata?.brandId || brandId;

    if (!userId && !email) {
      throw new Error("No user identifier found in session");
    }

    // Check if already processed
    const { data: existingOrder } = await supabase
      .from("upsell_orders")
      .select("id, status")
      .eq("session_id", sessionId)
      .single();

    if (existingOrder) {
      console.log("[verify-upsell-payment] Session already processed:", existingOrder.id);
      return new Response(
        JSON.stringify({ 
          success: true, 
          alreadyProcessed: true, 
          orderId: existingOrder.id,
          status: existingOrder.status,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Find brand if not provided
    let finalBrandId = metaBrandId;
    if (!finalBrandId && userId) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("active_brand_id")
        .eq("id", userId)
        .single();
      
      finalBrandId = profile?.active_brand_id;

      if (!finalBrandId) {
        const { data: brands } = await supabase
          .from("brands")
          .select("id")
          .eq("user_id", userId)
          .limit(1);
        
        finalBrandId = brands?.[0]?.id;
      }
    }

    // Create upsell order
    const { data: order, error: orderError } = await supabase
      .from("upsell_orders")
      .insert({
        session_id: sessionId,
        user_id: userId,
        brand_id: finalBrandId,
        email,
        product: "visuels_30",
        amount: (session.amount_total || 1900) / 100,
        status: "paid",
        total_visuals: 30,
        generated_count: 0,
      })
      .select()
      .single();

    if (orderError) {
      console.error("[verify-upsell-payment] Error creating order:", orderError);
      throw orderError;
    }

    console.log("[verify-upsell-payment] Order created:", order.id);

    // Trigger generation in background
    const generatePromise = supabase.functions.invoke("generate-upsell-pack", {
      body: {
        orderId: order.id,
        userId,
        brandId: finalBrandId,
      }
    });

    generatePromise.then((result) => {
      console.log("[verify-upsell-payment] Generation completed:", result.data);
    }).catch((error) => {
      console.error("[verify-upsell-payment] Generation error:", error);
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Payment verified, generation started",
        orderId: order.id,
        email,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[verify-upsell-payment] Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

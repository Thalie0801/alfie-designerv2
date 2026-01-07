import Stripe from "npm:stripe@18";
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { sessionId } = await req.json();

    if (!sessionId) {
      return new Response(
        JSON.stringify({ success: false, error: "sessionId required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[verify-express-payment] Verifying session:", sessionId);

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

    console.log("[verify-express-payment] Payment verified:", {
      email: session.customer_email,
      amount: session.amount_total,
      metadata: session.metadata,
    });

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user ID from metadata or email
    const userId = session.metadata?.supabase_user_id;
    const email = session.customer_email;

    if (!userId && !email) {
      throw new Error("No user identifier found in session");
    }

    // Find the user's brand
    let brandId: string | null = null;
    
    if (userId) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("active_brand_id")
        .eq("id", userId)
        .single();
      
      brandId = profile?.active_brand_id;

      // If no active brand, get the first brand
      if (!brandId) {
        const { data: brands } = await supabase
          .from("brands")
          .select("id")
          .eq("user_id", userId)
          .limit(1);
        
        brandId = brands?.[0]?.id;
      }
    }

    // Check if this session was already processed
    const { data: existingPayment } = await supabase
      .from("payment_sessions")
      .select("id")
      .eq("session_id", sessionId)
      .single();

    if (existingPayment) {
      console.log("[verify-express-payment] Session already processed");
      return new Response(
        JSON.stringify({ success: true, alreadyProcessed: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Record the payment
    await supabase.from("payment_sessions").insert({
      session_id: sessionId,
      user_id: userId,
      email,
      plan: "carousel10",
      amount: (session.amount_total || 0) / 100,
      verified: true,
    });

    // Trigger carousel generation in background
    if (userId && brandId && email) {
      console.log("[verify-express-payment] Triggering carousel generation...");
      
      // Use EdgeRuntime.waitUntil for background processing
      const generatePromise = supabase.functions.invoke("generate-carousel-pack", {
        body: {
          userId,
          brandId,
          email,
          sessionId,
        }
      });

      // Don't await - let it run in background
      generatePromise.then((result) => {
        console.log("[verify-express-payment] Carousel generation completed:", result.data);
      }).catch((error) => {
        console.error("[verify-express-payment] Carousel generation error:", error);
      });
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Payment verified, carousel generation started",
        email,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[verify-express-payment] Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

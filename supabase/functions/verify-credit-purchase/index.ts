import Stripe from "npm:stripe@18";
import { createClient } from "npm:@supabase/supabase-js@2";

import { corsHeaders } from "../_shared/cors.ts";
import { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } from "../_shared/env.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    SUPABASE_URL!,
    SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  try {
    const { session_id } = await req.json();
    
    if (!session_id) {
      throw new Error("Session ID required");
    }

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    // Retrieve session from Stripe
    const session = await stripe.checkout.sessions.retrieve(session_id);

    if (session.payment_status !== 'paid') {
      throw new Error("Payment not completed");
    }

    const userId = session.metadata?.user_id;
    const credits = parseInt(session.metadata?.credits || "0");

    if (!userId || !credits) {
      throw new Error("Invalid session metadata");
    }

    // Credit the user
    const { data: profile, error: fetchError } = await supabaseClient
      .from('profiles')
      .select('ai_credits_purchased')
      .eq('id', userId)
      .single();

    if (fetchError) throw fetchError;

    const newTotal = (profile?.ai_credits_purchased || 0) + credits;

    const { error: updateError } = await supabaseClient
      .from('profiles')
      .update({ ai_credits_purchased: newTotal })
      .eq('id', userId);

    if (updateError) throw updateError;

    // Log transaction
    await supabaseClient
      .from('credit_transactions')
      .insert({
        user_id: userId,
        amount: credits,
        transaction_type: 'purchase',
        action: 'credit_pack_purchase'
      });

    return new Response(JSON.stringify({ 
      success: true, 
      credits_added: credits,
      new_total: newTotal 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: any) {
    console.error("Error in verify-credit-purchase:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});

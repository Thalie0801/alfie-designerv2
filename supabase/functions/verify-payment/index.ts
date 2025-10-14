import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PLAN_CONFIG = {
  starter: { 
    quota_brands: 1, 
    quota_visuals: 125, 
    ai_credits_monthly: 150,
    alfie_requests: 100 
  },
  pro: { 
    quota_brands: 3, 
    quota_visuals: 335, 
    ai_credits_monthly: 375,
    alfie_requests: 250 
  },
  studio: { 
    quota_brands: 5, 
    quota_visuals: 600, 
    ai_credits_monthly: 750,
    alfie_requests: 500 
  },
  enterprise: { 
    quota_brands: 999, 
    quota_visuals: 9999, 
    ai_credits_monthly: 9999,
    alfie_requests: 9999 
  },
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    const { session_id } = await req.json();
    
    if (!session_id) {
      throw new Error("Session ID required");
    }

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    // Get checkout session details
    const session = await stripe.checkout.sessions.retrieve(session_id);
    
    if (session.payment_status !== "paid") {
      throw new Error("Payment not completed");
    }

    const plan = session.metadata?.plan;
    const userId = session.metadata?.user_id;
    const customerEmail = session.customer_details?.email;
    const affiliateRef = session.metadata?.affiliate_ref;

    if (!plan || !PLAN_CONFIG[plan as keyof typeof PLAN_CONFIG]) {
      throw new Error("Invalid plan in session metadata");
    }

    const planConfig = PLAN_CONFIG[plan as keyof typeof PLAN_CONFIG];

    // Update or create user profile
    if (userId) {
      // User was authenticated during checkout
      const { error } = await supabaseClient
        .from("profiles")
        .update({
          plan,
          quota_brands: planConfig.quota_brands,
          quota_visuals_per_month: planConfig.quota_visuals,
          ai_credits_monthly: planConfig.ai_credits_monthly,
          alfie_requests_this_month: 0,
          alfie_requests_reset_date: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1).toISOString(),
          stripe_customer_id: session.customer as string,
          stripe_subscription_id: session.subscription as string,
        })
        .eq("id", userId);

      if (error) throw error;
    } else if (customerEmail) {
      // Guest checkout - find or update profile by email
      const { data: existingProfile } = await supabaseClient
        .from("profiles")
        .select("id")
        .eq("email", customerEmail)
        .single();

      if (existingProfile) {
        await supabaseClient
          .from("profiles")
          .update({
            plan,
            quota_brands: planConfig.quota_brands,
            quota_visuals_per_month: planConfig.quota_visuals,
            ai_credits_monthly: planConfig.ai_credits_monthly,
            alfie_requests_this_month: 0,
            alfie_requests_reset_date: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1).toISOString(),
            stripe_customer_id: session.customer as string,
            stripe_subscription_id: session.subscription as string,
          })
          .eq("email", customerEmail);
      }
    }

    // Handle affiliate conversion if affiliate_ref exists
    if (affiliateRef && userId) {
      console.log("Processing affiliate conversion for ref:", affiliateRef);
      
      // Find the affiliate by their code (using id as the code)
      const { data: affiliate, error: affiliateError } = await supabaseClient
        .from("affiliates")
        .select("id")
        .eq("id", affiliateRef)
        .single();

      if (affiliate && !affiliateError) {
        console.log("Found affiliate:", affiliate.id);
        
        // Get the amount from session
        const amount = session.amount_total ? session.amount_total / 100 : 0;
        
        // Create the conversion
        const { data: conversion, error: conversionError } = await supabaseClient
          .from("affiliate_conversions")
          .insert({
            affiliate_id: affiliate.id,
            user_id: userId,
            plan,
            amount,
            status: "paid",
          })
          .select()
          .single();

        if (conversion && !conversionError) {
          console.log("Conversion created:", conversion.id);
          
          // Calculate MLM commissions (3 levels)
          const { error: commissionError } = await supabaseClient.rpc(
            "calculate_mlm_commissions",
            {
              conversion_id_param: conversion.id,
              direct_affiliate_id: affiliate.id,
              conversion_amount: amount,
            }
          );

          if (commissionError) {
            console.error("Error calculating commissions:", commissionError);
          } else {
            console.log("Commissions calculated successfully");
          }

          // Update affiliate status based on their performance
          const { error: statusError } = await supabaseClient.rpc(
            "update_affiliate_status",
            {
              affiliate_id_param: affiliate.id,
            }
          );

          if (statusError) {
            console.error("Error updating affiliate status:", statusError);
          } else {
            console.log("Affiliate status updated successfully");
          }
        } else {
          console.error("Error creating conversion:", conversionError);
        }
      } else {
        console.log("Affiliate not found or error:", affiliateError);
      }
    }

    // Send confirmation email
    await supabaseClient.functions.invoke("send-confirmation-email", {
      body: {
        email: customerEmail,
        plan,
        session_id,
      },
    });

    return new Response(
      JSON.stringify({ success: true, plan, email: customerEmail }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error("Error in verify-payment:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});

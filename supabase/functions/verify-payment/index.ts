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
    quota_images: 150, 
    quota_videos: 15,
    quota_woofs: 15
  },
  pro: { 
    quota_brands: 1, 
    quota_images: 450, 
    quota_videos: 45,
    quota_woofs: 45
  },
  studio: { 
    quota_brands: 1, 
    quota_images: 1000, 
    quota_videos: 100,
    quota_woofs: 100
  },
  enterprise: { 
    quota_brands: 999, 
    quota_images: 9999, 
    quota_videos: 9999,
    quota_woofs: 9999
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

    // Create or update user account based on email
    let targetUserId = userId;
    
    if (!userId && customerEmail) {
      // Guest checkout - create the user account via admin API
      const { data: newUser, error: createError } = await supabaseClient.auth.admin.createUser({
        email: customerEmail,
        email_confirm: true,
        user_metadata: { created_via: 'stripe_payment' }
      });

      if (createError) {
        console.error("Error creating user:", createError);
        throw new Error(`Failed to create user account: ${createError.message}`);
      }

      targetUserId = newUser.user.id;
      console.log("Created new user account:", targetUserId);
    }

    // Update profile with stripe info and global quota (for backward compatibility)
    if (targetUserId) {
      // Upsert profile to ensure it exists
      await supabaseClient
        .from("profiles")
        .upsert({
          id: targetUserId,
          user_id: targetUserId,
          email: customerEmail,
          plan,
          quota_brands: planConfig.quota_brands,
          stripe_customer_id: session.customer as string,
          stripe_subscription_id: session.subscription as string,
          status: 'active',
        }, { onConflict: 'user_id' });

      // Get or create active brand for this user
      const { data: profile } = await supabaseClient
        .from("profiles")
        .select("active_brand_id")
        .eq("id", targetUserId)
        .single();

      let brandId = profile?.active_brand_id;

      // If no active brand, get or create the first brand
      if (!brandId) {
        const { data: existingBrands } = await supabaseClient
          .from("brands")
          .select("id")
          .eq("user_id", targetUserId)
          .limit(1);

        if (existingBrands && existingBrands.length > 0) {
          brandId = existingBrands[0].id;
          // Set as active brand
          await supabaseClient
            .from("profiles")
            .update({ active_brand_id: brandId })
            .eq("id", targetUserId);
        } else {
          // Create first brand
          const { data: newBrand } = await supabaseClient
            .from("brands")
            .insert({
              user_id: targetUserId,
              name: "Ma Marque",
              plan: plan,
              quota_images: planConfig.quota_images,
              quota_videos: planConfig.quota_videos,
              quota_woofs: planConfig.quota_woofs,
              stripe_subscription_id: session.subscription as string,
            })
            .select()
            .single();

          if (newBrand) {
            brandId = newBrand.id;
            await supabaseClient
              .from("profiles")
              .update({ active_brand_id: brandId })
              .eq("id", targetUserId);
          }
        }
      }

      // Update the active brand with plan and quotas
      if (brandId) {
        await supabaseClient
          .from("brands")
          .update({
            plan: plan,
            quota_images: planConfig.quota_images,
            quota_videos: planConfig.quota_videos,
            quota_woofs: planConfig.quota_woofs,
            stripe_subscription_id: session.subscription as string,
          })
          .eq("id", brandId);
      }
    }

    // Handle affiliate conversion if affiliate_ref exists
    if (affiliateRef && targetUserId) {
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
            user_id: targetUserId,
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

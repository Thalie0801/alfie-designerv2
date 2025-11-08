import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { VerifyPaymentSchema, validateInput } from "../_shared/validation.ts";

const ALLOWED_ORIGINS = [
  'https://alfie-designer.lovable.app',
  'http://localhost:5173',
  'http://localhost:8080',
];

function getCorsHeaders(req: Request) {
  const origin = req.headers.get('origin');
  const allowedOrigin = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Credentials': 'true',
  };
}

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
  const corsHeaders = getCorsHeaders(req);
  
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    const body = await req.json();
    
    // Validate input with Zod
    const validation = validateInput(VerifyPaymentSchema, body);
    if (!validation.success) {
      return new Response(
        JSON.stringify({ 
          code: 'VALIDATION_ERROR',
          message: validation.error 
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        }
      );
    }
    
    const { session_id } = validation.data;
    
    // Check if payment session already processed (prevent replay attacks)
    const { data: existingSession, error: checkError } = await supabaseClient
      .from('payment_sessions')
      .select('id, verified')
      .eq('session_id', session_id)
      .maybeSingle();
    
    if (checkError) {
      console.error('Error checking existing session:', checkError);
    }
    
    if (existingSession?.verified) {
      console.warn(`⚠️ Payment replay attempt detected for session: ${session_id}`);
      return new Response(
        JSON.stringify({ 
          code: 'SESSION_ALREADY_USED',
          message: 'Ce paiement a déjà été traité' 
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        }
      );
    }

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    // Get checkout session details
    let session;
    try {
      session = await stripe.checkout.sessions.retrieve(session_id);
    } catch (stripeError) {
      console.error('Stripe error retrieving session:', stripeError);
      return new Response(
        JSON.stringify({ 
          code: 'SESSION_NOT_FOUND',
          message: 'Session de paiement introuvable' 
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 404,
        }
      );
    }
    
    if (session.payment_status !== "paid") {
      return new Response(
        JSON.stringify({ 
          code: 'PAYMENT_NOT_COMPLETED',
          message: 'Le paiement n\'a pas été complété' 
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        }
      );
    }

    const plan = session.metadata?.plan;
    const userId = session.metadata?.user_id;
    const customerEmail = session.customer_details?.email;
    const affiliateRef = session.metadata?.affiliate_ref;
    const brandName = session.metadata?.brand_name;

    // Handle brand purchase (additional brand for existing user)
    if (brandName && userId) {
      console.log(`🎨 Processing brand purchase for user ${userId}, brand: ${brandName}`);
      
      // Get starter plan config
      const starterConfig = PLAN_CONFIG.starter;
      
      // Create the new brand
      const { data: newBrand, error: brandError } = await supabaseClient
        .from('brands')
        .insert({
          user_id: userId,
          name: brandName,
          plan: 'starter',
          is_addon: true,
          quota_images: starterConfig.quota_images,
          quota_videos: starterConfig.quota_videos,
          quota_woofs: starterConfig.quota_woofs,
          stripe_subscription_id: session.subscription as string,
        })
        .select()
        .single();

      if (brandError) {
        console.error('Error creating brand:', brandError);
        return new Response(
          JSON.stringify({ 
            code: 'BRAND_CREATION_ERROR',
            message: 'Erreur lors de la création de la marque',
            details: brandError.message 
          }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 500,
          }
        );
      }

      console.log(`✅ Brand created: ${newBrand.id} - ${brandName}`);

      // Send confirmation email
      try {
        await supabaseClient.functions.invoke('send-confirmation-email', {
          body: {
            email: customerEmail,
            plan: 'starter',
            brand_name: brandName,
          },
        });
      } catch (emailError) {
        console.error('Email sending error:', emailError);
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          brand_id: newBrand.id,
          brand_name: brandName,
          plan: 'starter',
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    if (!plan || !PLAN_CONFIG[plan as keyof typeof PLAN_CONFIG]) {
      return new Response(
        JSON.stringify({ 
          code: 'INVALID_PLAN',
          message: 'Plan invalide dans la session de paiement',
          plan 
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        }
      );
    }

    const planConfig = PLAN_CONFIG[plan as keyof typeof PLAN_CONFIG];

    // Store payment session for signup verification
    // Using upsert with onConflict to prevent race conditions
    const { error: insertError } = await supabaseClient
      .from('payment_sessions')
      .upsert(
        {
          session_id,
          email: customerEmail,
          plan,
          verified: true,
          amount: session.amount_total ? session.amount_total / 100 : 0,
        },
        { 
          onConflict: 'session_id',
          ignoreDuplicates: false 
        }
      );

    if (insertError) {
      console.error('Error storing payment session:', insertError);
      // If it's a duplicate key error, treat as replay attempt
      if (insertError.code === '23505') {
        return new Response(
          JSON.stringify({ 
            code: 'SESSION_ALREADY_USED',
            message: 'Ce paiement a déjà été traité' 
          }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 400,
          }
        );
      }
      return new Response(
        JSON.stringify({ 
          code: 'STORAGE_ERROR',
          message: 'Erreur lors de l\'enregistrement de la session de paiement',
          details: insertError.message 
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 500,
        }
      );
    }

    console.log(`✅ Payment session stored for ${customerEmail}, plan: ${plan}`);

    // If user is already logged in (rare case), update their profile
    const targetUserId = userId;
    if (targetUserId) {
      await supabaseClient
        .from("profiles")
        .update({
          plan,
          quota_brands: planConfig.quota_brands,
          stripe_customer_id: session.customer as string,
          stripe_subscription_id: session.subscription as string,
          status: 'active',
        })
        .eq("id", targetUserId);

      console.log(`✅ Updated profile for existing user ${targetUserId}`);
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
      JSON.stringify({ 
        success: true, 
        plan, 
        email: customerEmail,
        code: 'SUCCESS'
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error("Error in verify-payment:", error);
    
    // Si c'est déjà une réponse structurée, la retourner telle quelle
    if (error instanceof Response) {
      return error;
    }
    
    // Sinon, retourner une erreur générique structurée
    return new Response(
      JSON.stringify({ 
        code: 'UNKNOWN_ERROR',
        message: error.message || 'Une erreur inconnue s\'est produite' 
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});

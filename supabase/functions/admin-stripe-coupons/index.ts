import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Vérifier l'authentification admin
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }), 
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }), 
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Vérifier que l'utilisateur est admin
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);

    const isAdmin = roles?.some((r) => r.role === "admin");
    if (!isAdmin) {
      return new Response(
        JSON.stringify({ error: "Forbidden - Admin access required" }), 
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeSecretKey) {
      return new Response(
        JSON.stringify({ error: "Stripe not configured" }), 
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: "2023-10-16",
    });

    const { action, ...params } = await req.json();

    // ACTION: list - Lister tous les coupons et codes promo
    if (action === "list") {
      console.log("[admin-stripe-coupons] Listing coupons and promo codes...");
      
      const [coupons, promoCodes] = await Promise.all([
        stripe.coupons.list({ limit: 100 }),
        stripe.promotionCodes.list({ limit: 100 }),
      ]);

      return new Response(
        JSON.stringify({
          ok: true,
          coupons: coupons.data,
          promo_codes: promoCodes.data,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ACTION: create - Créer un nouveau coupon + code promo
    if (action === "create") {
      const { code, percent_off, duration, duration_in_months, name, max_redemptions } = params;

      if (!code || !percent_off || !duration || !name) {
        return new Response(
          JSON.stringify({ error: "Missing required fields: code, percent_off, duration, name" }), 
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`[admin-stripe-coupons] Creating coupon: ${name} (${code})`);

      // Créer le coupon
      const couponData: any = {
        percent_off: parseInt(percent_off),
        duration,
        name,
      };

      if (duration === "repeating" && duration_in_months) {
        couponData.duration_in_months = parseInt(duration_in_months);
      }

      const coupon = await stripe.coupons.create(couponData);

      // Créer le code promo
      const promoCodeData: any = {
        coupon: coupon.id,
        code: code.toUpperCase(),
        restrictions: {
          first_time_transaction: false,
        },
      };

      if (max_redemptions) {
        promoCodeData.max_redemptions = parseInt(max_redemptions);
      }

      const promoCode = await stripe.promotionCodes.create(promoCodeData);

      console.log(`[admin-stripe-coupons] Created coupon ${coupon.id} with promo code ${promoCode.code}`);

      return new Response(
        JSON.stringify({
          ok: true,
          coupon_id: coupon.id,
          promo_code: promoCode.code,
          message: `Coupon ${promoCode.code} créé avec succès!`,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ACTION: deactivate - Désactiver un code promo
    if (action === "deactivate") {
      const { promo_code_id } = params;

      if (!promo_code_id) {
        return new Response(
          JSON.stringify({ error: "Missing promo_code_id" }), 
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`[admin-stripe-coupons] Deactivating promo code: ${promo_code_id}`);

      const promoCode = await stripe.promotionCodes.update(promo_code_id, {
        active: false,
      });

      return new Response(
        JSON.stringify({
          ok: true,
          promo_code: promoCode.code,
          message: `Code promo ${promoCode.code} désactivé`,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid action. Use: list, create, or deactivate" }), 
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error("[admin-stripe-coupons] Error:", error);
    
    if (error.type === 'StripeInvalidRequestError' && error.message.includes('already exists')) {
      return new Response(
        JSON.stringify({ 
          error: "Ce coupon ou code promo existe déjà dans Stripe",
          details: error.message 
        }), 
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ 
        error: "Erreur lors de l'opération",
        details: error.message 
      }), 
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

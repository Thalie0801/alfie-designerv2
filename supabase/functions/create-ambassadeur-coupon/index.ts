import Stripe from "npm:stripe@18";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Vérifier l'authentification via INTERNAL_FN_SECRET
    const authHeader = req.headers.get("authorization");
    const internalSecret = Deno.env.get("INTERNAL_FN_SECRET");
    
    if (!authHeader || authHeader !== `Bearer ${internalSecret}`) {
      console.error("[create-ambassadeur-coupon] Unauthorized access attempt");
      return new Response(
        JSON.stringify({ error: "Unauthorized" }), 
        { 
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeSecretKey) {
      console.error("[create-ambassadeur-coupon] STRIPE_SECRET_KEY not configured");
      return new Response(
        JSON.stringify({ error: "Stripe not configured" }), 
        { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const stripe = new Stripe(stripeSecretKey);

    console.log("[create-ambassadeur-coupon] Creating 40% coupon...");

    // 1. Créer le coupon 40% (forever = s'applique à vie)
    const coupon = await stripe.coupons.create({
      percent_off: 40,
      duration: "forever",
      name: "Ambassadeur -40%",
    });

    console.log(`[create-ambassadeur-coupon] Coupon created: ${coupon.id}`);

    // 2. Créer le code promo AMBASSADEUR
    const promoCode = await stripe.promotionCodes.create({
      coupon: coupon.id,
      code: "AMBASSADEUR",
      restrictions: {
        first_time_transaction: false, // peut être utilisé même si déjà client
      },
    });

    console.log(`[create-ambassadeur-coupon] Promo code created: ${promoCode.code}`);

    return new Response(
      JSON.stringify({
        ok: true,
        coupon_id: coupon.id,
        promo_code: promoCode.code,
        message: "Coupon AMBASSADEUR créé avec succès! Les utilisateurs peuvent maintenant l'utiliser au checkout.",
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  } catch (error: any) {
    console.error("[create-ambassadeur-coupon] Error:", error);
    
    // Gestion des erreurs Stripe spécifiques
    if (error.type === 'StripeInvalidRequestError' && error.message.includes('already exists')) {
      return new Response(
        JSON.stringify({ 
          error: "Le coupon ou code promo AMBASSADEUR existe déjà dans Stripe",
          details: error.message 
        }), 
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    return new Response(
      JSON.stringify({ 
        error: "Erreur lors de la création du coupon",
        details: error.message 
      }), 
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});

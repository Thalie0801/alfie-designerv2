import Stripe from "npm:stripe@18";
import { corsHeaders } from "../_shared/cors.ts";
import { isAdminUser } from "../_shared/auth.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } from "../_shared/env.ts";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Decode JWT to get user info (Supabase has already validated it with verify_jwt=true)
function decodeJWT(token: string): { sub: string; email: string } | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    
    const payload = JSON.parse(atob(parts[1]));
    return { sub: payload.sub, email: payload.email };
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get JWT from Authorization header (already validated by Supabase with verify_jwt=true)
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      console.error("[admin-stripe-coupons] No authorization header");
      return json({ error: "Unauthorized" }, 401);
    }

    // Decode JWT to get user info
    const token = authHeader.replace("Bearer ", "");
    const decoded = decodeJWT(token);
    
    if (!decoded || !decoded.sub || !decoded.email) {
      console.error("[admin-stripe-coupons] Invalid JWT payload");
      return json({ error: "Unauthorized" }, 401);
    }

    const userId = decoded.sub;
    const userEmail = decoded.email;
    
    console.log("[admin-stripe-coupons] User found:", userEmail);

    // Create service role client to check admin status
    const supabaseAdmin = createClient(SUPABASE_URL ?? "", SUPABASE_SERVICE_ROLE_KEY ?? "");
    
    // Check admin status using shared utility
    const { data: roles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);

    const isAdmin = isAdminUser(userEmail, roles, { logContext: "admin-stripe-coupons" });
    
    if (!isAdmin) {
      console.error("[admin-stripe-coupons] User is not admin:", userEmail);
      return json({ error: "Forbidden - Admin access required" }, 403);
    }

    console.log("[admin-stripe-coupons] Admin access granted for:", userEmail);

    const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeSecretKey) {
      return json({ error: "Stripe not configured" }, 500);
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

      return json({
        ok: true,
        coupons: coupons.data,
        promo_codes: promoCodes.data,
      });
    }

    // ACTION: create - Créer un nouveau coupon + code promo
    if (action === "create") {
      const { code, percent_off, duration, duration_in_months, name, max_redemptions } = params;

      if (!code || !percent_off || !duration || !name) {
        return json({ error: "Missing required fields: code, percent_off, duration, name" }, 400);
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

      return json({
        ok: true,
        coupon_id: coupon.id,
        promo_code: promoCode.code,
        message: `Coupon ${promoCode.code} créé avec succès!`,
      });
    }

    // ACTION: deactivate - Désactiver un code promo
    if (action === "deactivate") {
      const { promo_code_id } = params;

      if (!promo_code_id) {
        return json({ error: "Missing promo_code_id" }, 400);
      }

      console.log(`[admin-stripe-coupons] Deactivating promo code: ${promo_code_id}`);

      const promoCode = await stripe.promotionCodes.update(promo_code_id, {
        active: false,
      });

      return json({
        ok: true,
        promo_code: promoCode.code,
        message: `Code promo ${promoCode.code} désactivé`,
      });
    }

    return json({ error: "Invalid action. Use: list, create, or deactivate" }, 400);

  } catch (error: any) {
    console.error("[admin-stripe-coupons] Error:", error);
    
    if (error.type === 'StripeInvalidRequestError' && error.message.includes('already exists')) {
      return json({ 
        error: "Ce coupon ou code promo existe déjà dans Stripe",
        details: error.message 
      }, 400);
    }

    return json({ 
      error: "Erreur lors de l'opération",
      details: error.message 
    }, 500);
  }
});

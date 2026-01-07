import { createClient } from "npm:@supabase/supabase-js@2";
import { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY } from "../_shared/env.ts";
import { WOOF_COSTS } from "../_shared/woofsCosts.ts";
import { corsHeaders } from "../_shared/cors.ts";

const admin = createClient(
  SUPABASE_URL ?? "",
  SUPABASE_SERVICE_ROLE_KEY ?? "",
  { auth: { autoRefreshToken: false, persistSession: false } }
);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // 1️⃣ Vérifier si c'est un appel interne via x-internal-secret
    const internalSecret = req.headers.get("x-internal-secret") || req.headers.get("X-Internal-Secret");
    const INTERNAL_FN_SECRET = Deno.env.get("INTERNAL_FN_SECRET");
    const isInternalCall = internalSecret && INTERNAL_FN_SECRET && internalSecret === INTERNAL_FN_SECRET;

    // 2️⃣ Lire le body UNE SEULE FOIS
    const rawBody = await req.json();
    console.log("[woofs-check-consume] Raw body received:", JSON.stringify(rawBody));
    const payload = rawBody.body || rawBody;

    let userId: string;

    if (isInternalCall) {
      // Appel interne - récupérer userId depuis le body
      userId = payload.userId;
      if (!userId) {
        return new Response(
          JSON.stringify({ 
            ok: false, 
            error: { 
              code: "MISSING_USER_ID", 
              message: "userId requis pour appel interne" 
            } 
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      console.log(`[woofs-check-consume] ✅ Internal call for user: ${userId}`);
    } else {
      // 3️⃣ Authentification JWT standard
      const authHeader = req.headers.get("Authorization");
      if (!authHeader) {
        return new Response(
          JSON.stringify({ 
            ok: false, 
            error: { 
              code: "MISSING_AUTH", 
              message: "Authorization header manquant" 
            } 
          }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const supabaseAuth = createClient(SUPABASE_URL ?? "", SUPABASE_ANON_KEY ?? "", {
        global: { headers: { Authorization: authHeader } }
      });

      const { data: { user }, error: userError } = await supabaseAuth.auth.getUser();
      if (userError || !user) {
        console.error("[woofs-check-consume] Invalid token:", userError);
        return new Response(
          JSON.stringify({ 
            ok: false, 
            error: { 
              code: "UNAUTHORIZED", 
              message: "Token invalide ou expiré" 
            } 
          }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

    userId = user.id;
    console.log(`[woofs-check-consume] Authenticated user: ${userId}`);
  }

  // 4️⃣ Vérifier si l'utilisateur est admin (quotas illimités)
  const { data: isAdmin } = await admin.rpc("has_role", {
    _user_id: userId,
    _role: "admin",
  });

  if (isAdmin) {
    console.log(`[woofs-check-consume] 👑 Admin user detected - bypassing quota checks`);
  }

  // 5️⃣ Continuer avec la logique existante
  const { brand_id, cost_woofs, reason, metadata } = payload;

    if (!brand_id || cost_woofs === undefined || !reason) {
      console.error("[woofs-check-consume] Missing fields in payload:", { brand_id, cost_woofs, reason, rawBody });
      throw new Error("Missing required fields: brand_id, cost_woofs, reason");
    }

    console.log(`[woofs-check-consume] Checking ${cost_woofs} Woofs for brand ${brand_id} (reason: ${reason})`);

    // 1. Récupérer les quotas de la brand ET vérifier propriété
    const { data: brand, error: brandError } = await admin
      .from("brands")
      .select("id, user_id, quota_woofs, plan")
      .eq("id", brand_id)
      .single();

    if (brandError || !brand) {
      throw new Error(`Brand not found: ${brandError?.message}`);
    }

    // ✅ VÉRIFICATION PROPRIÉTÉ DE LA MARQUE
    if (brand.user_id !== userId) {
      console.error(`[woofs-check-consume] User ${userId} attempted to consume Woofs for brand ${brand_id} owned by ${brand.user_id}`);
      return new Response(
        JSON.stringify({ 
          ok: false, 
          error: { 
            code: "FORBIDDEN", 
            message: "Accès non autorisé à cette marque" 
          } 
        }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const woofs_limit = brand.quota_woofs || 150;

    // 2. Récupérer la période courante (YYYYMM)
    const now = new Date();
    const period = parseInt(
      now.getFullYear().toString() + 
      (now.getMonth() + 1).toString().padStart(2, '0')
    );

    // 3. Récupérer les compteurs mensuels
    const { data: counters, error: countersError } = await admin
      .from("counters_monthly")
      .select("woofs_used")
      .eq("brand_id", brand_id)
      .eq("period_yyyymm", period)
      .maybeSingle();

    if (countersError) {
      console.error("[woofs-check-consume] Error fetching counters:", countersError);
      throw countersError;
    }

    const woofs_used = counters?.woofs_used || 0;
    const remaining = woofs_limit - woofs_used;

    console.log(`[woofs-check-consume] Current usage: ${woofs_used}/${woofs_limit} Woofs (remaining: ${remaining})`);

    // 4. Vérifier si suffisamment de Woofs (bypass pour admins)
    if (!isAdmin && woofs_used + cost_woofs > woofs_limit) {
      console.warn(`[woofs-check-consume] INSUFFICIENT_WOOFS: need ${cost_woofs}, have ${remaining}`);
      return new Response(
        JSON.stringify({
          ok: false,
          error: {
            code: "INSUFFICIENT_WOOFS",
            message: "Tu n'as plus assez de Woofs pour cette génération.",
            remaining: remaining,
            required: cost_woofs,
          },
        }),
        { 
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }

    // 5. Consommer les Woofs de manière atomique
    const { error: incrementError } = await admin.rpc("increment_monthly_counters", {
      p_brand_id: brand_id,
      p_period_yyyymm: period,
      p_images: 0,
      p_reels: 0,
      p_woofs: cost_woofs,
    });

    if (incrementError) {
      console.error("[woofs-check-consume] Error incrementing counters:", incrementError);
      throw incrementError;
    }

    const new_woofs_used = woofs_used + cost_woofs;
    const new_remaining = woofs_limit - new_woofs_used;
    const threshold_80 = (new_woofs_used / woofs_limit) >= 0.8;

    // 6. Logger l'événement d'usage
    await admin.from("usage_event").insert({
      brand_id: brand_id,
      kind: reason,
      meta: {
        cost_woofs,
        ...metadata,
      },
    });

    console.log(`[woofs-check-consume] ✅ Consumed ${cost_woofs} Woofs. New usage: ${new_woofs_used}/${woofs_limit}`);

    return new Response(
      JSON.stringify({
        ok: true,
        data: {
          remaining_woofs: new_remaining,
          woofs_limit: woofs_limit,
          woofs_used: new_woofs_used,
          threshold_80: threshold_80,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[woofs-check-consume] Error:", error);
    return new Response(
      JSON.stringify({ 
        ok: false, 
        error: { 
          code: "INTERNAL_ERROR",
          message: error?.message || "Unknown error"
        } 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

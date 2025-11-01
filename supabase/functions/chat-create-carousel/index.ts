import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { generateMasterSeed } from "../_shared/seedGenerator.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-idempotency-key",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Missing Authorization header");
    }

    const idem = req.headers.get("x-idempotency-key") ?? crypto.randomUUID();
    const { brandId, prompt, count, aspectRatio } = await req.json();

    console.log(`[CreateCarousel] Request: brandId=${brandId}, count=${count}, prompt="${prompt}"`);

    // Admin client for service operations
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // User client for auth
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    // Get user from JWT
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      throw new Error("Unauthorized");
    }

    console.log(`[CreateCarousel] User authenticated: ${user.id}`);

    // 1) Idempotency guard
    const { data: iKey } = await adminClient
      .from("idempotency_keys")
      .insert({ key: idem, status: "pending" })
      .select()
      .maybeSingle();

    if (!iKey) {
      // Déjà créé, retourner le dernier job_set
      const { data: reuse } = await adminClient
        .from("job_sets")
        .select("id")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      
      console.log(`[CreateCarousel] Idempotency key already exists, returning existing job_set: ${reuse?.id}`);
      return json({ jobSetId: reuse?.id });
    }

    // 2) Vérifier et réserver les quotas
    console.log(`[CreateCarousel] Reserving ${count} visuals for brand ${brandId}`);
    
    const { data: quotaResult, error: quotaErr } = await adminClient.rpc(
      "reserve_brand_quotas",
      {
        p_brand_id: brandId,
        p_visuals_count: count,
        p_reels_count: 0,
        p_woofs_count: 0,
      }
    );

    if (quotaErr) {
      console.error("[CreateCarousel] Quota check error:", quotaErr);
      throw new Error(`Quota error: ${quotaErr.message}`);
    }

    if (!quotaResult?.[0]?.success) {
      console.error("[CreateCarousel] Quota exceeded:", quotaResult?.[0]?.reason);
      throw new Error(quotaResult?.[0]?.reason || "quota_exceeded");
    }

    console.log(`[CreateCarousel] Quota reserved successfully`);
    
    // AUSSI incrémenter counters_monthly pour synchronisation
    const now = new Date();
    const periodYYYYMM = parseInt(
      now.getFullYear().toString() + 
      (now.getMonth() + 1).toString().padStart(2, '0')
    );

    console.log(`[CreateCarousel] Incrementing monthly counters for brand ${brandId} in period ${periodYYYYMM}`);
    
    const { error: monthlyCounterError } = await adminClient.rpc('increment_monthly_counters', {
      p_brand_id: brandId,
      p_period_yyyymm: periodYYYYMM,
      p_images: count,
      p_reels: 0,
      p_woofs: 0
    });

    if (monthlyCounterError) {
      console.error('[CreateCarousel] Failed to increment monthly counters:', monthlyCounterError);
      // Non-fatal mais important à log
    } else {
      console.log('[CreateCarousel] Monthly counters incremented successfully');
    }

    // 3) Créer le job_set
    const { data: set, error: setErr } = await adminClient
      .from("job_sets")
      .insert({
        brand_id: brandId,
        user_id: user.id,
        request_text: prompt,
        total: count,
        status: "queued",
        master_seed: generateMasterSeed(),
        constraints: {},
      })
      .select()
      .single();

    if (setErr || !set) {
      console.error("[CreateCarousel] Job set creation failed:", setErr);
      
      // Refund quota
      await adminClient.rpc("refund_brand_quotas", {
        p_brand_id: brandId,
        p_visuals_count: count,
      });
      
      throw new Error(`Job set creation failed: ${setErr?.message}`);
    }

    console.log(`[CreateCarousel] Job set created: ${set.id}`);

    // 4) Récupérer les données de la marque pour brand_snapshot
    const { data: brand, error: brandErr } = await adminClient
      .from("brands")
      .select("palette, voice, logo_url, name")
      .eq("id", brandId)
      .single();

    if (brandErr || !brand) {
      console.error("[CreateCarousel] Brand fetch failed:", brandErr);
      await adminClient.rpc("refund_brand_quotas", {
        p_brand_id: brandId,
        p_visuals_count: count,
      });
      throw new Error(`Brand not found: ${brandErr?.message}`);
    }

    // 5) Appeler alfie-plan-carousel AVANT de créer les jobs pour obtenir un plan structuré
    let carouselPlan = null;
    try {
      console.log(`[CreateCarousel] Calling alfie-plan-carousel for structured content...`);
      
      const planResponse = await fetch(
        `${Deno.env.get("SUPABASE_URL")}/functions/v1/alfie-plan-carousel`,
        {
          method: 'POST',
          headers: {
            'Authorization': authHeader,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            prompt,
            brandKit: {
              name: brand.name,
              palette: brand.palette,
              voice: brand.voice,
            },
            slideCount: count,
          }),
        }
      );

      if (planResponse.ok) {
        carouselPlan = await planResponse.json();
        console.log(`[CreateCarousel] Plan received:`, JSON.stringify(carouselPlan, null, 2));
      } else {
        console.warn(`[CreateCarousel] Plan generation failed (${planResponse.status}), using fallback structure`);
      }
    } catch (planError) {
      console.warn(`[CreateCarousel] Plan generation error:`, planError);
    }

    // 5.5) Si le plan a échoué, utiliser une structure de base
    if (!carouselPlan || !carouselPlan.slides) {
      console.warn(`[CreateCarousel] Using fallback slide structure`);
      carouselPlan = {
        globals: {
          audience: "Directeurs Marketing & studios internes",
          promise: "Des visuels toujours on-brand, plus vite.",
          cta: "Rejoindre l'accès anticipé",
          terminology: [],
          banned: []
        },
        slides: Array(count).fill(null).map((_, i) => ({
          type: i === 0 ? 'hero' : 'variant',
          title: `Slide ${i + 1}`,
          subtitle: prompt.slice(0, 60),
        })),
        captions: []
      };
    }

    // 6) Construire le brand_snapshot enrichi avec globals
    const brandSnapshot = {
      palette: brand.palette || [],
      colors: brand.palette || [],
      brand_voice: brand.voice || null,
      voice: brand.voice || null,
      logo_url: brand.logo_url || null,
      name: brand.name || "Brand",
      aspectRatio: aspectRatio || "4:5",
      master_seed: set.master_seed,
      globals: carouselPlan.globals,
    } as Record<string, any>;

    const nonNullBrandSnapshot = brandSnapshot ?? {};

    // 7) Créer les jobs avec le contenu structuré DÈS LA CRÉATION
    console.log(`[CreateCarousel] Creating jobs with slideContent from plan...`);
    const jobs = Array.from({ length: count }, (_, i) => ({
      job_set_id: set.id,
      index_in_set: i,
      status: "queued",
      prompt,
      slide_template: carouselPlan.slides[i]?.type || (i === 0 ? "hero" : "variant"),
      brand_snapshot: nonNullBrandSnapshot,
      metadata: {
        role: i === 0 ? "key_visual" : "variant",
        slideContent: carouselPlan.slides[i] || { type: 'variant', title: '' },
      },
    }));

    const { error: jobsErr } = await adminClient.from("jobs").insert(jobs);

    if (jobsErr) {
      console.error("[CreateCarousel] Jobs creation failed:", jobsErr);
      await adminClient.rpc("refund_brand_quotas", {
        p_brand_id: brandId,
        p_visuals_count: count,
      });
      throw new Error(`Jobs creation failed: ${jobsErr.message}`);
    }

    console.log(`[CreateCarousel] ${count} jobs created for set ${set.id} with structured content`)

    // 6) Marquer l'idempotency comme appliquée
    await adminClient
      .from("idempotency_keys")
      .update({ status: "applied", result_ref: set.id })
      .eq("key", idem);

    console.log(`[CreateCarousel] Success! Job set ${set.id} ready for processing`);

    return json({ jobSetId: set.id });
  } catch (e: any) {
    console.error("[CreateCarousel] Error:", e);
    return json({ error: e.message }, 400);
  }
});

const json = (b: any, s = 200) =>
  new Response(JSON.stringify(b), {
    status: s,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

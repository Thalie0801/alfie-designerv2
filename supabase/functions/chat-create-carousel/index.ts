import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY, env } from "../_shared/env.ts";
import { generateMasterSeed } from "../_shared/seedGenerator.ts";

import { corsHeaders } from "../_shared/cors.ts";
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Missing Authorization header");
    }

    const idem = req.headers.get("x-idempotency-key") ?? crypto.randomUUID();
    const body = await req.json();
    const { brandId, prompt, count, aspectRatio } = body;

    // ✅ LOG D'ENTRÉE COMPLET pour debug
    console.log('[chat-create-carousel] START', {
      brandId,
      prompt: prompt?.substring(0, 100),
      count,
      aspectRatio,
      hasAuth: !!authHeader,
      idempotencyKey: idem
    });

    // Admin client for service operations
    const adminClient = createClient(
      SUPABASE_URL ?? "",
      SUPABASE_SERVICE_ROLE_KEY ?? ""
    );

    // User client for auth
    const userClient = createClient(
      SUPABASE_URL ?? "",
      SUPABASE_ANON_KEY ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    // Get user from JWT
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      throw new Error("Unauthorized");
    }

    console.log(`[CreateCarousel] User authenticated: ${user.id}`);

    // 🔒 SÉCURITÉ: Vérifier que la marque appartient bien à l'utilisateur
    const { data: brandOwnership, error: brandCheckError } = await adminClient
      .from("brands")
      .select("user_id")
      .eq("id", brandId)
      .single();

    if (brandCheckError || !brandOwnership) {
      console.error(`[CreateCarousel] Brand ${brandId} not found`);
      throw new Error("Brand not found");
    }

    if (brandOwnership.user_id !== user.id) {
      console.error(`[CreateCarousel] ⛔ User ${user.id} tried to access brand ${brandId} owned by ${brandOwnership.user_id}`);
      return new Response(JSON.stringify({ 
        error: "Forbidden: you don't own this brand" 
      }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    console.log(`[CreateCarousel] ✅ Brand ownership verified for user ${user.id}`);

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

    // 3) Créer le job_set avec l'aspectRatio
    const { data: set, error: setErr } = await adminClient
      .from("job_sets")
      .insert({
        brand_id: brandId,
        user_id: user.id,
        request_text: prompt,
        total: count,
        status: "queued",
        master_seed: generateMasterSeed(),
        constraints: {
          aspectRatio: aspectRatio || '9:16', // ✅ Stocker l'aspect ratio demandé
        },
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
        `${SUPABASE_URL}/functions/v1/alfie-plan-carousel`,
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
        const planData = await planResponse.json();
        carouselPlan = planData?.plan ?? planData; // compat legacy
        
        if (planData?.fallback) {
          console.warn(`[CreateCarousel] ⚠️ Using fallback plan from alfie-plan-carousel`);
        }
        
        console.log(`[CreateCarousel] Plan received:`, JSON.stringify(carouselPlan, null, 2));
      } else {
        console.warn(`[CreateCarousel] Plan generation failed (${planResponse.status}), using local fallback`);
      }
    } catch (planError) {
      console.warn(`[CreateCarousel] Plan generation error:`, planError);
    }

    // 5.5) Si le plan a échoué OU slides vides, utiliser une structure cohérente et complète
    if (!carouselPlan?.slides || carouselPlan.slides.length === 0) {
      console.warn(`[CreateCarousel] Using coherent fallback slide structure`);
      const fallbackGlobals = {
        audience: "Directeurs Marketing & studios internes",
        promise: "Des visuels toujours on-brand, plus vite.",
        cta: "Essayer Alfie",
        terminology: ["cohérence de marque", "variantes", "workflows"],
        banned: ["révolutionnaire", "magique", "illimité"]
      };
      
      carouselPlan = {
        globals: fallbackGlobals,
        slides: count === 5 ? [
          {
            type: 'hero',
            title: 'Créez des visuels cohérents',
            subtitle: 'L\'IA qui garde vos créations on-brand',
            punchline: 'Cohérence garantie',
            badge: 'Cohérence 95/100',
            cta_primary: fallbackGlobals.cta
          },
          {
            type: 'problem',
            title: 'Le défi de la cohérence',
            bullets: [
              'Visuels incohérents',
              'Validations manuelles',
              'Marque diluée'
            ]
          },
          {
            type: 'solution',
            title: fallbackGlobals.promise,
            bullets: [
              'IA garde-fous',
              'Variantes cohérentes',
              'Workflows accélérés'
            ]
          },
          {
            type: 'impact',
            title: 'Résultats mesurables',
            kpis: [
              { label: 'Cohérence', delta: '+92%' },
              { label: 'Temps', delta: '-60%' },
              { label: 'Production', delta: '×3' }
            ]
          },
          {
            type: 'cta',
            title: 'Prêt à essayer ?',
            subtitle: 'Rejoignez les équipes créatives',
            cta_primary: fallbackGlobals.cta,
            cta_secondary: 'En savoir plus',
            note: 'Accès anticipé disponible pour studios et équipes marketing'
          }
        ] : count === 3 ? [
          {
            type: 'hero',
            title: 'Visuels cohérents',
            subtitle: fallbackGlobals.promise,
            cta_primary: fallbackGlobals.cta
          },
          {
            type: 'solution',
            title: 'Solution complète',
            bullets: [
              'Cohérence garantie',
              'Créations rapides',
              'Workflows simples'
            ]
          },
          {
            type: 'cta',
            title: fallbackGlobals.cta,
            cta_primary: fallbackGlobals.cta,
            note: 'Accès anticipé disponible'
          }
        ] : Array(count).fill(null).map((_, i) => ({
          type: i === 0 ? 'hero' : 'variant',
          title: i === 0 ? 'Créez avec cohérence' : prompt.slice(0, 40),
          subtitle: i === 0 ? fallbackGlobals.promise : prompt.slice(0, 60)
        })),
        captions: Array(Math.min(count, 3)).fill('').map((_, i) => 
          `Post ${i + 1}: ${prompt.slice(0, 80)}... #coherence`
        )
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

    // 7) Créer UN job unique dans job_queue avec toutes les slides
    console.log(`[CreateCarousel] Creating job in job_queue with slideContent from plan...`);
    
    // Préparer les slides avec leur contenu structuré
    const slides = Array.from({ length: count }, (_, i) => {
      const slide = carouselPlan.slides[i] || {};
      return {
        index: i,
        slide_template: slide.type || (i === 0 ? "hero" : i === count-1 ? "cta" : "body"),
        role: i === 0 ? "key_visual" : "variant",
        slideContent: {
          type: slide.type || (i === 0 ? "hero" : i === count-1 ? "cta" : "body"),
          title: slide.title ?? `Slide ${i + 1}`,
          subtitle: slide.subtitle ?? "",
          punchline: slide.punchline ?? "",
          bullets: Array.isArray(slide.bullets) ? slide.bullets : [],
          cta_primary: slide.cta_primary ?? slide.cta ?? "",
          cta_secondary: slide.cta_secondary ?? "",
          badge: slide.badge ?? "",
          kpis: Array.isArray(slide.kpis) ? slide.kpis : [],
          note: slide.note ?? ""
        },
      };
    });

    const { error: jobsErr } = await adminClient.from("job_queue").insert({
      user_id: user.id,
      brand_id: brandId,
      type: "render_carousels",
      status: "queued",
      payload: {
        jobSetId: set.id,
        userId: user.id,
        brandId: brandId,
        prompt,
        count,
        aspectRatio: aspectRatio || "4:5",
        brand_snapshot: nonNullBrandSnapshot,
        slides,
        carouselPlan
      }
    });

    if (jobsErr) {
      console.error("[CreateCarousel] Job creation failed:", jobsErr);
      await adminClient.rpc("refund_brand_quotas", {
        p_brand_id: brandId,
        p_visuals_count: count,
      });
      throw new Error(`Job creation failed: ${jobsErr.message}`);
    }

    console.log(`[CreateCarousel] Job created for set ${set.id} with structured content`);

    // Déclencher le worker immédiatement
    try {
      console.log(`[CreateCarousel] Triggering alfie-job-worker...`);
      const { error: workerError } = await adminClient.functions.invoke("alfie-job-worker", {
        body: { trigger: "chat-create-carousel" }
      });
      if (workerError) {
        console.error("[CreateCarousel] Worker trigger failed:", workerError);
      } else {
        console.log("[CreateCarousel] Worker triggered successfully");
      }
    } catch (workerErr) {
      console.error("[CreateCarousel] Worker invocation error:", workerErr);
    }

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

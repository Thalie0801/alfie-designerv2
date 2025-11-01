import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { withIdempotency } from "../_shared/idempotency.ts";
import { userHasAccess } from "../_shared/accessControl.ts";
import { resolveBrandKit } from "../_shared/brandResolver.ts";
import { generateMasterSeed } from "../_shared/seedGenerator.ts";

function correctFrenchSpelling(text: string): string {
  const corrections: Record<string, string> = {
    'developper': 'développer',
    'developpe': 'développe',
    'developpement': 'développement',
    'apeller': 'appeler',
    'apelle': 'appelle',
    'reelement': 'réellement',
    'reele': 'réelle',
    'evenement': 'événement',
    'evenements': 'événements',
    'connexion': 'connexion',
    'connection': 'connexion',
    'addresse': 'adresse',
    'language': 'langage',
  };

  let corrected = text;
  for (const [wrong, right] of Object.entries(corrections)) {
    const regex = new RegExp(`\\b${wrong}\\b`, 'gi');
    corrected = corrected.replace(regex, right);
  }
  return corrected;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-idempotency-key',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Missing authorization');

    const idempotencyKey = req.headers.get('x-idempotency-key');
    if (!idempotencyKey) throw new Error('Missing x-idempotency-key header');

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );
    if (userError || !user) throw new Error('Unauthorized');

    const hasAccess = await userHasAccess(authHeader);
    if (!hasAccess) throw new Error('Access denied');

    const { brandId, prompt, count, aspectRatio = '4:5' } = await req.json();

    // 🔒 SÉCURITÉ: Vérifier que la marque appartient bien à l'utilisateur
    const { data: brandOwnership, error: brandCheckError } = await supabase
      .from("brands")
      .select("user_id")
      .eq("id", brandId)
      .single();

    if (brandCheckError || !brandOwnership) {
      console.error(`[create-job-set] Brand ${brandId} not found`);
      throw new Error("Brand not found");
    }

    if (brandOwnership.user_id !== user.id) {
      console.error(`[create-job-set] ⛔ User ${user.id} tried to access brand ${brandId} owned by ${brandOwnership.user_id}`);
      return new Response(JSON.stringify({ 
        error: "Forbidden: you don't own this brand" 
      }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    console.log(`[create-job-set] ✅ Brand ownership verified for user ${user.id}`);

    // Normaliser le nombre de slides (1-10, défaut 5)
    const requestedCount = typeof count === 'number' ? count : 5;
    const normalizedCount = Math.max(1, Math.min(10, requestedCount));

    if (!brandId || !prompt || normalizedCount < 1 || normalizedCount > 10) {
      throw new Error('Invalid request parameters');
    }

    // ✅ IDEMPOTENCY WRAPPER
    const jobSet = await withIdempotency(idempotencyKey, async () => {
      console.log(`[create-job-set] Starting for brand ${brandId}, count=${normalizedCount}, aspect=${aspectRatio}`);

      // 1. Réserver les quotas ATOMIQUEMENT
      const { data: quotaResult, error: quotaErr } = await supabase.rpc('reserve_brand_quotas', {
        p_brand_id: brandId,
        p_visuals_count: normalizedCount,
        p_reels_count: 0,
        p_woofs_count: 0
      });

      if (quotaErr || !quotaResult?.[0]?.success) {
        throw new Error(quotaResult?.[0]?.reason || 'Quota reservation failed');
      }

      // 2. Générer le master seed pour la cohérence du carrousel
      const masterSeed = generateMasterSeed();
      console.log(`[create-job-set] Generated master_seed: ${masterSeed}`);

      // 3. Récupérer le Brand Kit (snapshot)
      const brandSnapshot = await resolveBrandKit(brandId);

      // 4. Construire les contraintes de cohérence
      const constraints = {
        palette: [
          brandSnapshot.primary_color,
          brandSnapshot.secondary_color,
          brandSnapshot.accent_color
        ].filter(Boolean),
        voice: brandSnapshot.voice || 'professional',
        layout_hint: aspectRatio === '1:1' ? 'centered_composition' : 'vertical_hero',
        contrast_min: 4.5, // WCAG AA
        no_text: true
      };

      // 5. Appeler alfie-plan-carousel
      const { data: plan, error: planErr } = await supabase.functions.invoke('alfie-plan-carousel', {
        body: { prompt, brandKit: brandSnapshot, slideCount: normalizedCount }
      });

      if (planErr || !plan?.slides) {
        // Refund quotas
        await supabase.rpc('refund_brand_quotas', {
          p_brand_id: brandId,
          p_visuals_count: normalizedCount
        });
        throw new Error('Carousel planning failed');
      }

      // 6. Créer le job_set avec master_seed et constraints
      const { data: newJobSet, error: jobSetErr } = await supabase
        .from('job_sets')
        .insert({
          user_id: user.id,
          brand_id: brandId,
          request_text: prompt,
          total: normalizedCount,
          status: 'queued',
          master_seed: masterSeed,
          constraints: constraints
        })
        .select()
        .single();

      if (jobSetErr) throw jobSetErr;

      // 7. Phase 8: Créer les N jobs avec correction orthographique, templates détectés automatiquement
      const brandSnapshotWithAspect = { 
        ...brandSnapshot, 
        aspectRatio,
        master_seed: masterSeed // Propager le master_seed au worker
      };
      
      const jobsData = plan.slides.slice(0, normalizedCount).map((slide: any, i: number) => {
        const rawPrompt = `${slide.title}. ${slide.subtitle || ''}`;
        const correctedPrompt = correctFrenchSpelling(rawPrompt);
        
        // Déterminer le template automatiquement
        let templateType = 'hero';
        if (i === 0) {
          templateType = 'hero';
        } else if (slide.bullets && slide.bullets.length > 0) {
          templateType = i === 1 ? 'problem' : 'solution';
        } else if (slide.kpis && slide.kpis.length > 0) {
          templateType = 'impact';
        } else if (slide.cta && i === normalizedCount - 1) {
          templateType = 'cta';
        }
        
        return {
          job_set_id: newJobSet.id,
          index_in_set: i,
          prompt: correctedPrompt,
          slide_template: templateType, // Phase 2: nouveau champ
          brand_snapshot: brandSnapshotWithAspect,
          metadata: { 
            role: i === 0 ? 'key_visual' : 'variant',
            title: slide.title,
            subtitle: slide.subtitle,
            punchline: slide.punchline,
            bullets: slide.bullets,
            cta: slide.cta,
            cta_primary: slide.cta_primary,
            cta_secondary: slide.cta_secondary,
            note: slide.note,
            badge: slide.badge,
            kpis: slide.kpis
          },
          status: 'queued'
        };
      });

      const { error: jobsErr } = await supabase
        .from('jobs')
        .insert(jobsData);

      if (jobsErr) throw jobsErr;

      console.log(`[create-job-set] Created job_set ${newJobSet.id} with ${normalizedCount} jobs`);

      return {
        ref: `job_set:${newJobSet.id}`,
        data: newJobSet
      };
    });

    return new Response(JSON.stringify(jobSet), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('[create-job-set] Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: error.message === 'Unauthorized' ? 401 : 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { enrichPromptWithBrand } from "../_shared/brandResolver.ts";
import { deriveSeed } from "../_shared/seedGenerator.ts";
import { checkCoherence } from "../_shared/coherenceChecker.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Correction orthographique française
function correctFrenchSpelling(text: string): string {
  const corrections: Record<string, string> = {
    'puisence': 'puissance',
    'décupèle': 'décuplée',
    'décuplèe': 'décuplée',
    'vidéos captatives': 'vidéos captivantes',
    'Marktplace': 'Marketplace',
    'Marketpace': 'Marketplace',
    'libérze': 'libérez',
    'automutéée': 'automatisée',
    'automutée': 'automatisée',
    'integration': 'intégration',
    'créativ': 'créatif',
    'visuals': 'visuels',
    'captvatines': 'captivantes',
    'est nouvel nouvel': 'est un nouvel',
    'vidéos étans': 'vidéos uniques',
    'en en quequess': 'en quelques',
    'artifécralle': 'artificielle',
    'partranaire': 'partenaire',
    "d'éeil": "d'œil"
  };

  let corrected = text;
  for (const [wrong, right] of Object.entries(corrections)) {
    const regex = new RegExp(wrong, 'gi');
    corrected = corrected.replace(regex, right);
  }
  
  return corrected;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 1. Récupérer 1 job en attente (FIFO) et le verrouiller atomiquement
    const { data: job, error: jobErr } = await supabase
      .from('jobs')
      .select('*, job_sets!inner(brand_id, user_id, master_seed, constraints)')
      .eq('status', 'queued')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (jobErr || !job) {
      return new Response(JSON.stringify({ message: 'No jobs to process' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`[Worker] Processing job ${job.id} (index: ${job.index_in_set})`);

    // 2. Marquer comme "running" ATOMIQUEMENT (seulement si encore queued)
    const { data: lockedJob, error: lockErr } = await supabase
      .from('jobs')
      .update({ status: 'running', started_at: new Date().toISOString() })
      .eq('id', job.id)
      .eq('status', 'queued') // CRITIQUE: ne mettre à jour que si toujours queued
      .select()
      .maybeSingle();

    // Si le job a déjà été pris par un autre worker, on arrête
    if (lockErr || !lockedJob) {
      console.log(`[Worker] Job ${job.id} already taken by another worker, skipping`);
      return new Response(JSON.stringify({ message: 'Job already taken' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // 3. Récupérer brand_snapshot et déterminer le seed selon le rôle
    const brandSnapshot = job.brand_snapshot;
    const isKeyVisual = job.metadata?.role === 'key_visual';
    const masterSeedStr = brandSnapshot?.master_seed || job.job_sets.master_seed;
    
    let seed: string | undefined;
    if (masterSeedStr) {
      if (isKeyVisual) {
        seed = masterSeedStr; // Image #0 = seed maître
        console.log(`[Worker] Generating KEY VISUAL with master seed ${seed?.slice(0, 12)}...`);
      } else {
        seed = deriveSeed(masterSeedStr, job.index_in_set);
        console.log(`[Worker] Generating VARIANT #${job.index_in_set} with derived seed ${seed?.slice(0, 12)}...`);
      }
    }

    // 4. Corriger l'orthographe puis enrichir le prompt avec Brand Kit
    const correctedPrompt = correctFrenchSpelling(job.prompt);
    const enrichedPrompt = enrichPromptWithBrand(correctedPrompt, brandSnapshot);
    let finalPrompt = `${enrichedPrompt} CRITICAL: Ne rends AUCUN mot ni texte dans l'image (no text). Composition uniquement graphique.`;
    if (brandSnapshot?.logo_url) {
      finalPrompt += ` Ajoute systématiquement l'avatar/logo de la marque en bas à droite avec une marge de sécurité, même style et taille sur toutes les slides (cohérence branding).`;
    }

    // 5. Déterminer la résolution selon l'aspect ratio propagé
    const aspectRatio = brandSnapshot?.aspectRatio || '4:5';
    const resolution = aspectRatio === '1:1' ? '1080x1080' : '1080x1350';

    // 6. Appeler alfie-generate-ai-image avec seed déterministe (si disponible)
    const brandKit = brandSnapshot ? {
      id: job.job_sets.brand_id,
      palette: brandSnapshot.palette || brandSnapshot.colors || null,
      voice: brandSnapshot.brand_voice || brandSnapshot.voice || null,
      logo_url: brandSnapshot.logo_url || null
    } : undefined;

    const { data: imageData, error: imageErr } = await supabase.functions.invoke('alfie-generate-ai-image', {
      body: {
        prompt: finalPrompt,
        resolution,
        brandKit,
        seed, // Passer le seed pour la cohérence (key_visual = master, variants = dérivé)
        guidance_scale: isKeyVisual ? 6.0 : 5.5 // Key visual légèrement plus fidèle au prompt
      }
    });

    // Helper pour mettre à jour le statut du job_set
    const updateJobSetStatus = async () => {
      const { data: allJobs } = await supabase
        .from('jobs')
        .select('status')
        .eq('job_set_id', job.job_set_id);

      const statuses = allJobs?.map(j => j.status) || [];
      const allDone = statuses.every(s => ['succeeded', 'failed'].includes(s));
      const anyFailed = statuses.some(s => s === 'failed');

      let jobSetStatus = 'running';
      if (allDone) {
        jobSetStatus = anyFailed ? 'partial' : 'done';
      }

      await supabase
        .from('job_sets')
        .update({ status: jobSetStatus, updated_at: new Date().toISOString() })
        .eq('id', job.job_set_id);

      return jobSetStatus;
    };

    const outUrl = imageData?.imageUrl || imageData?.url;

    if (imageErr || !outUrl) {
      // Échec → marquer et refund
      await supabase
        .from('jobs')
        .update({
          status: 'failed',
          error: imageErr?.message || 'Image generation failed',
          finished_at: new Date().toISOString()
        })
        .eq('id', job.id);

      await supabase.rpc('refund_brand_quotas', {
        p_brand_id: job.job_sets.brand_id,
        p_visuals_count: 1
      });

      // Mettre à jour le statut du set même en cas d'échec
      await updateJobSetStatus();

      console.error(`[Worker] Job ${job.id} failed:`, imageErr?.message);
      return new Response(JSON.stringify({ success: false, jobId: job.id, error: imageErr?.message }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // 7. Vérifier la cohérence (optionnel, MVP retourne score fixe)
    const coherenceScore = await checkCoherence(outUrl, job.job_sets.constraints || {});

    // 8. Créer l'asset dans media_generations avec score de cohérence
    const { data: asset } = await supabase
      .from('media_generations')
      .insert({
        user_id: job.job_sets.user_id,
        brand_id: job.job_sets.brand_id,
        type: 'image',
        output_url: outUrl,
        status: 'completed',
        prompt: job.prompt,
        metadata: { 
          job_id: job.id, 
          job_set_id: job.job_set_id,
          coherence_score: coherenceScore,
          role: isKeyVisual ? 'key_visual' : 'variant'
        }
      })
      .select()
      .single();

    // 9. Marquer le job comme réussi
    await supabase
      .from('jobs')
      .update({
        status: 'succeeded',
        asset_id: asset.id,
        finished_at: new Date().toISOString()
      })
      .eq('id', job.id);

    // 10. Si c'est le key visual, mettre à jour job_set.style_ref_asset_id
    if (isKeyVisual && asset) {
      await supabase
        .from('job_sets')
        .update({ style_ref_asset_id: asset.id })
        .eq('id', job.job_set_id);
      console.log(`[Worker] Updated job_set ${job.job_set_id} with style_ref_asset_id ${asset.id}`);
    }

    // 11. Mettre à jour le statut du job_set
    const finalStatus = await updateJobSetStatus();

    console.log(`[Worker] Job ${job.id} completed successfully (set status: ${finalStatus}, coherence: ${coherenceScore.total}/100)`);

    return new Response(JSON.stringify({ success: true, jobId: job.id, assetId: asset.id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('[Worker] Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { enrichPromptWithBrand } from "../_shared/brandResolver.ts";

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
      .select('*, job_sets!inner(brand_id, user_id)')
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

    // 3. Corriger l'orthographe puis enrichir le prompt avec Brand Kit
    const brandSnapshot = job.brand_snapshot;
    const correctedPrompt = correctFrenchSpelling(job.prompt);
    const enrichedPrompt = enrichPromptWithBrand(correctedPrompt, brandSnapshot);

    // 4. Appeler alfie-generate-ai-image (ne nécessite pas de token utilisateur)
    const brandKit = brandSnapshot ? {
      id: job.job_sets.brand_id,
      palette: brandSnapshot.palette || brandSnapshot.colors || null,
      voice: brandSnapshot.brand_voice || brandSnapshot.voice || null,
      logo_url: brandSnapshot.logo_url || null
    } : undefined;

    const { data: imageData, error: imageErr } = await supabase.functions.invoke('alfie-generate-ai-image', {
      body: {
        prompt: enrichedPrompt,
        resolution: '1080x1350', // 4:5 ratio
        brandKit
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

    // 5. Créer l'asset dans media_generations
    const { data: asset } = await supabase
      .from('media_generations')
      .insert({
        user_id: job.job_sets.user_id,
        brand_id: job.job_sets.brand_id,
        type: 'image',
        output_url: outUrl,
        status: 'completed',
        prompt: job.prompt,
        metadata: { job_id: job.id, job_set_id: job.job_set_id }
      })
      .select()
      .single();

    // 6. Marquer le job comme réussi
    await supabase
      .from('jobs')
      .update({
        status: 'succeeded',
        asset_id: asset.id,
        finished_at: new Date().toISOString()
      })
      .eq('id', job.id);

    // 7. Mettre à jour le statut du job_set
    const finalStatus = await updateJobSetStatus();

    console.log(`[Worker] Job ${job.id} completed successfully (set status: ${finalStatus})`);

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

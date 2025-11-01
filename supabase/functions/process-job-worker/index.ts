import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { enrichPromptWithBrand } from "../_shared/brandResolver.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 1. Récupérer 1 job en attente (FIFO)
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

    console.log(`[Worker] Processing job ${job.id} (${job.index_in_set + 1}/${job.job_sets.total})`);

    // 2. Marquer comme "running"
    await supabase
      .from('jobs')
      .update({ status: 'running', started_at: new Date().toISOString() })
      .eq('id', job.id);

    // 3. Enrichir le prompt avec Brand Kit
    const brandSnapshot = job.brand_snapshot;
    const enrichedPrompt = enrichPromptWithBrand(job.prompt, brandSnapshot);

    // 4. Appeler generate-ai-image
    const { data: imageData, error: imageErr } = await supabase.functions.invoke('generate-ai-image', {
      body: {
        prompt: enrichedPrompt,
        aspectRatio: '4:5',
        brandId: job.job_sets.brand_id
      }
    });

    if (imageErr || !imageData?.url) {
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

      throw imageErr;
    }

    // 5. Créer l'asset dans media_generations
    const { data: asset } = await supabase
      .from('media_generations')
      .insert({
        user_id: job.job_sets.user_id,
        brand_id: job.job_sets.brand_id,
        type: 'image',
        output_url: imageData.url,
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

    console.log(`[Worker] Job ${job.id} completed successfully`);

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

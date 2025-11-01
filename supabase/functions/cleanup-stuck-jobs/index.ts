import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Réinitialiser les jobs en "running" depuis plus de 5 minutes
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    
    console.log(`[Cleanup] Looking for jobs stuck in 'running' before ${fiveMinutesAgo}`);
    
    const { data: stuckJobs, error: selectError } = await supabase
      .from('jobs')
      .select('id, index_in_set, job_set_id, started_at')
      .eq('status', 'running')
      .lt('started_at', fiveMinutesAgo);

    if (selectError) {
      console.error('[Cleanup] Failed to select stuck jobs:', selectError);
      throw selectError;
    }

    if (!stuckJobs || stuckJobs.length === 0) {
      console.log('[Cleanup] No stuck jobs found');
      return new Response(JSON.stringify({ cleaned: 0 }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`[Cleanup] Found ${stuckJobs.length} stuck jobs:`, stuckJobs.map(j => j.id));

    // Marquer comme failed avec message explicite
    const { data: updatedJobs, error: updateError } = await supabase
      .from('jobs')
      .update({ 
        status: 'failed',
        error: 'Timeout - exceeded 5 minutes in running state',
        finished_at: new Date().toISOString()
      })
      .in('id', stuckJobs.map(j => j.id))
      .select('id');

    if (updateError) {
      console.error('[Cleanup] Failed to update stuck jobs:', updateError);
      throw updateError;
    }

    console.log(`[Cleanup] Cleaned up ${updatedJobs?.length || 0} stuck jobs`);

    // Mettre à jour les statuts des job_sets affectés
    const jobSetIds = [...new Set(stuckJobs.map(j => j.job_set_id))];
    
    for (const jobSetId of jobSetIds) {
      const { data: allJobs } = await supabase
        .from('jobs')
        .select('status')
        .eq('job_set_id', jobSetId);

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
        .eq('id', jobSetId);

      console.log(`[Cleanup] Updated job_set ${jobSetId} to status: ${jobSetStatus}`);
    }

    return new Response(JSON.stringify({ 
      cleaned: updatedJobs?.length || 0,
      jobs: updatedJobs
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('[Cleanup] Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

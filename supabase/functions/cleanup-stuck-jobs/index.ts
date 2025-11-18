import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

import { corsHeaders } from "../_shared/cors.ts";
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response("ok", { headers: corsHeaders });
  }

  console.log('🧹 [Cleanup] Starting stuck jobs cleanup...');
  console.log(`[Cleanup] Timestamp: ${new Date().toISOString()}`);
  
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Réinitialiser les jobs en "running" depuis plus de 5 minutes
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    
    console.log(`[Cleanup] Cutoff time: ${fiveMinutesAgo}`);
    console.log(`[Cleanup] Looking for jobs stuck in 'running' state...`);
    
    const { data: stuckJobs, error: selectError } = await supabase
      .from('jobs')
      .select('id, index_in_set, job_set_id, started_at')
      .eq('status', 'running')
      .lt('started_at', fiveMinutesAgo);

    if (selectError) {
      console.error('❌ [Cleanup] Failed to select stuck jobs:', selectError);
      throw selectError;
    }

    if (!stuckJobs || stuckJobs.length === 0) {
      console.log('✅ [Cleanup] No stuck jobs found - system healthy');
      return new Response(JSON.stringify({ 
        cleaned: 0,
        message: 'No stuck jobs found',
        timestamp: new Date().toISOString()
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`⚠️ [Cleanup] Found ${stuckJobs.length} stuck jobs:`, 
      stuckJobs.map(j => ({ id: j.id.slice(0, 8), index: j.index_in_set, started: j.started_at })));

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
      console.error('❌ [Cleanup] Failed to update stuck jobs:', updateError);
      throw updateError;
    }

    console.log(`✅ [Cleanup] Marked ${updatedJobs?.length || 0} jobs as failed`);

    // Mettre à jour les statuts des job_sets affectés
    const jobSetIds = [...new Set(stuckJobs.map(j => j.job_set_id))];
    console.log(`📦 [Cleanup] Updating ${jobSetIds.length} affected job_sets...`);
    
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

      console.log(`✅ [Cleanup] job_set ${jobSetId.slice(0, 8)}... → ${jobSetStatus}`);
    }

    console.log('🎉 [Cleanup] Cleanup completed successfully');
    
    return new Response(JSON.stringify({ 
      success: true,
      cleaned: updatedJobs?.length || 0,
      jobSetsUpdated: jobSetIds.length,
      details: {
        jobs: updatedJobs?.map(j => j.id.slice(0, 8) + '...'),
        timestamp: new Date().toISOString()
      }
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('❌ [Cleanup] Critical error:', error);
    console.error('📍 [Cleanup] Error message:', error.message);
    console.error('📍 [Cleanup] Error stack:', error.stack);
    return new Response(JSON.stringify({ 
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

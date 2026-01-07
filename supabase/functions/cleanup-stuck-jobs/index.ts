import { createClient } from "npm:@supabase/supabase-js@2";

import { corsHeaders } from "../_shared/cors.ts";
import { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } from "../_shared/env.ts";

const MAX_RETRIES = 3;
const STUCK_THRESHOLD_MINUTES = 5;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response("ok", { headers: corsHeaders });
  }

  console.log('🧹 [Cleanup] Starting stuck jobs cleanup...');
  console.log(`[Cleanup] Timestamp: ${new Date().toISOString()}`);
  
  try {
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    const cutoffTime = new Date(Date.now() - STUCK_THRESHOLD_MINUTES * 60 * 1000).toISOString();
    
    console.log(`[Cleanup] Cutoff time: ${cutoffTime}`);
    console.log(`[Cleanup] Looking for jobs stuck in 'running' state...`);
    
    // Sélectionner les jobs bloqués
    const { data: stuckJobs, error: selectError } = await supabase
      .from('job_queue')
      .select('id, order_id, user_id, created_at, updated_at, retry_count')
      .eq('status', 'running')
      .lt('updated_at', cutoffTime);

    if (selectError) {
      console.error('❌ [Cleanup] Failed to select stuck jobs:', selectError);
      throw selectError;
    }

    if (!stuckJobs || stuckJobs.length === 0) {
      console.log('✅ [Cleanup] No stuck jobs found - system healthy');
      return new Response(JSON.stringify({ 
        cleaned: 0,
        retried: 0,
        failed: 0,
        message: 'No stuck jobs found',
        timestamp: new Date().toISOString()
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`⚠️ [Cleanup] Found ${stuckJobs.length} stuck jobs`);

    // Séparer les jobs qui peuvent être retentés de ceux qui doivent échouer
    const retriableJobs = stuckJobs.filter(j => (j.retry_count || 0) < MAX_RETRIES);
    const failedJobs = stuckJobs.filter(j => (j.retry_count || 0) >= MAX_RETRIES);

    let retriedCount = 0;
    let failedCount = 0;

    // ✅ RETRY : Remettre en queue les jobs qui peuvent être retentés
    // FIX: Update each job individually to correctly increment its own retry_count
    if (retriableJobs.length > 0) {
      console.log(`🔄 [Cleanup] Retrying ${retriableJobs.length} jobs (retry_count < ${MAX_RETRIES})`);
      
      for (const job of retriableJobs) {
        const newRetryCount = (job.retry_count || 0) + 1;
        const { error: retryError } = await supabase
          .from('job_queue')
          .update({ 
            status: 'queued',
            error: null,
            retry_count: newRetryCount,
            updated_at: new Date().toISOString()
          })
          .eq('id', job.id);

        if (retryError) {
          console.error(`❌ [Cleanup] Failed to retry job ${job.id.slice(0, 8)}:`, retryError);
        } else {
          retriedCount++;
          console.log(`✅ [Cleanup] Re-queued job ${job.id.slice(0, 8)} (retry ${newRetryCount}/${MAX_RETRIES})`);
        }
      }
    }

    // ❌ FAIL : Marquer comme failed les jobs qui ont dépassé le max de retries
    if (failedJobs.length > 0) {
      console.log(`💀 [Cleanup] Failing ${failedJobs.length} jobs (retry_count >= ${MAX_RETRIES})`);
      
      const { data: markedFailed, error: failError } = await supabase
        .from('job_queue')
        .update({ 
          status: 'failed',
          error: `Timeout - exceeded ${STUCK_THRESHOLD_MINUTES} minutes in running state after ${MAX_RETRIES} retries`,
          updated_at: new Date().toISOString()
        })
        .in('id', failedJobs.map(j => j.id))
        .select('id');

      if (failError) {
        console.error('❌ [Cleanup] Failed to mark jobs as failed:', failError);
      } else {
        failedCount = markedFailed?.length || 0;
        console.log(`✅ [Cleanup] Marked ${failedCount} jobs as failed`);
      }
    }

    // Mettre à jour les statuts des orders affectés par les jobs définitivement failed
    const failedOrderIds = [...new Set(failedJobs.map(j => j.order_id).filter(Boolean))];
    console.log(`📦 [Cleanup] Updating ${failedOrderIds.length} affected orders...`);
    
    for (const orderId of failedOrderIds) {
      const { data: allJobs } = await supabase
        .from('job_queue')
        .select('status')
        .eq('order_id', orderId);

      const statuses = allJobs?.map(j => j.status) || [];
      const allDone = statuses.every(s => ['completed', 'failed'].includes(s));
      const anyFailed = statuses.some(s => s === 'failed');

      let orderStatus = 'processing';
      if (allDone) {
        orderStatus = anyFailed ? 'partial' : 'completed';
      }

      await supabase
        .from('orders')
        .update({ status: orderStatus, updated_at: new Date().toISOString() })
        .eq('id', orderId);

      console.log(`✅ [Cleanup] order ${orderId.slice(0, 8)}... → ${orderStatus}`);
    }

    console.log('🎉 [Cleanup] Cleanup completed successfully');
    
    return new Response(JSON.stringify({ 
      success: true,
      retried: retriedCount,
      failed: failedCount,
      ordersUpdated: failedOrderIds.length,
      details: {
        retriedJobs: retriableJobs.map(j => j.id.slice(0, 8) + '...'),
        failedJobs: failedJobs.map(j => j.id.slice(0, 8) + '...'),
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

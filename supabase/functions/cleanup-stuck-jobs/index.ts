import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

import { corsHeaders } from "../_shared/cors.ts";
import { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } from "../_shared/env.ts";

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response("ok", { headers: corsHeaders });
  }

  console.log('🧹 [Cleanup] Starting stuck jobs cleanup...');
  console.log(`[Cleanup] Timestamp: ${new Date().toISOString()}`);
  
  try {
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    // Réinitialiser les jobs en "running" depuis plus de 5 minutes
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    
    console.log(`[Cleanup] Cutoff time: ${fiveMinutesAgo}`);
    console.log(`[Cleanup] Looking for jobs stuck in 'running' state...`);
    
    const { data: stuckJobs, error: selectError } = await supabase
      .from('job_queue')
      .select('id, order_id, user_id, created_at, updated_at')
      .eq('status', 'running')
      .lt('updated_at', fiveMinutesAgo);

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
      stuckJobs.map(j => ({ id: j.id.slice(0, 8), order: j.order_id?.slice(0, 8), updated: j.updated_at })));

    // Marquer comme failed avec message explicite
    const { data: updatedJobs, error: updateError } = await supabase
      .from('job_queue')
      .update({ 
        status: 'failed',
        error: 'Timeout - exceeded 5 minutes in running state',
        updated_at: new Date().toISOString()
      })
      .in('id', stuckJobs.map(j => j.id))
      .select('id');

    if (updateError) {
      console.error('❌ [Cleanup] Failed to update stuck jobs:', updateError);
      throw updateError;
    }

    console.log(`✅ [Cleanup] Marked ${updatedJobs?.length || 0} jobs as failed`);

    // Mettre à jour les statuts des orders affectés
    const orderIds = [...new Set(stuckJobs.map(j => j.order_id).filter(Boolean))];
    console.log(`📦 [Cleanup] Updating ${orderIds.length} affected orders...`);
    
    for (const orderId of orderIds) {
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
      cleaned: updatedJobs?.length || 0,
      ordersUpdated: orderIds.length,
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

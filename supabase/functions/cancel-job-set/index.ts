import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  console.log('[CancelJobSet] Function invoked, method:', req.method);
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Authenticate user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { jobSetId } = await req.json();
    
    if (!jobSetId) {
      return new Response(JSON.stringify({ error: 'Missing jobSetId' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('[CancelJobSet] Request from user:', user.id, 'for job_set:', jobSetId);

    // Load job_set with brand info
    const { data: jobSet, error: jobSetError } = await supabaseAdmin
      .from('job_sets')
      .select('id, brand_id, user_id, status, total')
      .eq('id', jobSetId)
      .maybeSingle();

    if (jobSetError || !jobSet) {
      console.error('[CancelJobSet] Job set not found:', jobSetError);
      return new Response(JSON.stringify({ error: 'Job set not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Check permissions: user must own the job_set or the brand
    if (jobSet.user_id !== user.id) {
      const { data: brand } = await supabaseAdmin
        .from('brands')
        .select('user_id')
        .eq('id', jobSet.brand_id)
        .maybeSingle();
      
      if (!brand || brand.user_id !== user.id) {
        return new Response(JSON.stringify({ error: 'Forbidden: not your job set or brand' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // If already canceled or completed, no-op
    if (['canceled', 'done', 'failed'].includes(jobSet.status)) {
      console.log('[CancelJobSet] Job set already in terminal state:', jobSet.status);
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'Job set already finished',
        jobSetStatus: jobSet.status,
        canceledJobs: 0,
        refundedVisuals: 0
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Count remaining jobs (queued or running)
    const { data: remainingJobs, error: jobsError } = await supabaseAdmin
      .from('jobs')
      .select('id, index_in_set')
      .eq('job_set_id', jobSetId)
      .in('status', ['queued', 'running']);

    if (jobsError) {
      console.error('[CancelJobSet] Failed to fetch jobs:', jobsError);
      throw jobsError;
    }

    const remainingCount = remainingJobs?.length || 0;
    console.log('[CancelJobSet] Remaining jobs to cancel:', remainingCount);

    // Cancel all remaining jobs
    if (remainingCount > 0) {
      const { error: updateJobsError } = await supabaseAdmin
        .from('jobs')
        .update({ 
          status: 'canceled', 
          started_at: null,
          error: 'Canceled by user',
          finished_at: new Date().toISOString()
        })
        .eq('job_set_id', jobSetId)
        .in('status', ['queued', 'running']);

      if (updateJobsError) {
        console.error('[CancelJobSet] Failed to update jobs:', updateJobsError);
        throw updateJobsError;
      }
    }

    // Update job_set status to canceled
    const { error: updateSetError } = await supabaseAdmin
      .from('job_sets')
      .update({ 
        status: 'canceled',
        updated_at: new Date().toISOString()
      })
      .eq('id', jobSetId);

    if (updateSetError) {
      console.error('[CancelJobSet] Failed to update job_set:', updateSetError);
      throw updateSetError;
    }

    // Refund quotas for remaining jobs
    if (remainingCount > 0) {
      const now = new Date();
      const periodYYYYMM = parseInt(
        now.getFullYear().toString() + 
        (now.getMonth() + 1).toString().padStart(2, '0')
      );
      
      console.log(`[CancelJobSet] Refunding ${remainingCount} visuals for brand ${jobSet.brand_id} in period ${periodYYYYMM}`);
      
      // Rembourser dans counters_monthly (système unifié)
      const { error: refundMonthlyError } = await supabaseAdmin.rpc('decrement_monthly_counters', {
        p_brand_id: jobSet.brand_id,
        p_period_yyyymm: periodYYYYMM,
        p_images: remainingCount,
        p_reels: 0,
        p_woofs: 0
      });

      if (refundMonthlyError) {
        console.error('[CancelJobSet] Failed to refund monthly counters:', refundMonthlyError);
        // Non-blocking mais important de log
      } else {
        console.log('[CancelJobSet] Monthly counters refunded successfully');
      }
      
      // AUSSI rembourser dans brands (rétro-compatibilité pendant migration)
      const { error: refundBrandError } = await supabaseAdmin.rpc('refund_brand_quotas', {
        p_brand_id: jobSet.brand_id,
        p_visuals_count: remainingCount
      });

      if (refundBrandError) {
        console.error('[CancelJobSet] Failed to refund brand quotas:', refundBrandError);
        // Non-blocking: continue even if refund fails
      } else {
        console.log('[CancelJobSet] Brand quotas refunded successfully');
      }
    }

    console.log('[CancelJobSet] Success:', {
      jobSetId,
      canceledJobs: remainingCount,
      refundedVisuals: remainingCount
    });

    return new Response(JSON.stringify({ 
      success: true,
      jobSetId,
      canceledJobs: remainingCount,
      refundedVisuals: remainingCount,
      jobSetStatus: 'canceled'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('[CancelJobSet] Error:', error);
    return new Response(JSON.stringify({ 
      error: error.message || 'Internal server error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

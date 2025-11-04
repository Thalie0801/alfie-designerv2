import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[cleanup-stuck-jobs] Starting cleanup');

    // Initialize Supabase admin client
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // Call the reset_stuck_jobs RPC function (5 minutes threshold)
    const { data: resetData, error: resetError } = await supabaseAdmin.rpc('reset_stuck_jobs', {
      threshold_minutes: 5
    });

    if (resetError) {
      console.error('[cleanup-stuck-jobs] Error calling reset_stuck_jobs:', resetError);
      return new Response(
        JSON.stringify({ 
          ok: false, 
          error: resetError.message,
          details: resetError 
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const resetCount = resetData || 0;
    console.log(`[cleanup-stuck-jobs] Reset ${resetCount} stuck job(s)`);

    // Optionally: mark jobs with retry_count >= 3 as 'failed'
    const { data: failedJobs, error: failError } = await supabaseAdmin
      .from('job_queue')
      .update({ 
        status: 'failed',
        error: 'Max retries exceeded (3 attempts)',
        updated_at: new Date().toISOString()
      })
      .eq('status', 'queued')
      .gte('retry_count', 3)
      .select('id, type, retry_count');

    if (failError) {
      console.warn('[cleanup-stuck-jobs] Error failing max-retry jobs:', failError);
    } else {
      console.log(`[cleanup-stuck-jobs] Marked ${failedJobs?.length || 0} job(s) as failed (max retries)`);
    }

    return new Response(
      JSON.stringify({
        ok: true,
        reset: resetCount,
        failed: failedJobs?.length || 0,
        timestamp: new Date().toISOString()
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error: any) {
    console.error('[cleanup-stuck-jobs] Fatal error:', error);
    return new Response(
      JSON.stringify({
        ok: false,
        error: error?.message || 'Unknown error',
        details: error
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});

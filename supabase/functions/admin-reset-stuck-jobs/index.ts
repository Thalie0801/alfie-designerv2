import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { 
  SUPABASE_URL, 
  SUPABASE_ANON_KEY, 
  SUPABASE_SERVICE_ROLE_KEY,
  ADMIN_EMAILS 
} from "../_shared/env.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
      console.error("[admin-reset-stuck-jobs] ❌ Missing Supabase credentials");
      return new Response(
        JSON.stringify({ error: 'Server misconfigured' }), 
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseClient = createClient(
      SUPABASE_URL,
      SUPABASE_ANON_KEY,
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    // Vérifier l'authentification
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }), 
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Vérifier les droits admin via env
    const adminEmails = (ADMIN_EMAILS ?? '')
      .split(',')
      .map(e => e.trim().toLowerCase())
      .filter(Boolean);
    const userEmail = user.email?.toLowerCase() || '';
    
    if (!adminEmails.includes(userEmail)) {
      return new Response(
        JSON.stringify({ error: 'Forbidden - Admin access required' }), 
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[ADMIN] Resetting stuck jobs for admin:', userEmail);

    // Appeler la fonction reset_stuck_jobs avec service role
    const supabaseAdmin = createClient(
      SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { data, error } = await supabaseAdmin.rpc('reset_stuck_jobs', { timeout_minutes: 5, max_attempts: 3 });

    if (error) {
      console.error('[ADMIN] Error resetting stuck jobs:', error);
      return new Response(
        JSON.stringify({ error: error.message }), 
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const summary = Array.isArray(data) ? data[0] : data;
    const resetCount = summary?.reset_count ?? 0;
    const failedCount = summary?.failed_count ?? 0;

    console.log('[ADMIN] ✅ Reset stuck jobs:', { resetCount, failedCount });

    return new Response(
      JSON.stringify({
        success: true,
        reset_count: resetCount,
        failed_count: failedCount,
        message: `${resetCount} job(s) relancé(s), ${failedCount} marqué(s) en échec`
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[ADMIN] Exception:', error);
    return new Response(
      JSON.stringify({ error: error.message }), 
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

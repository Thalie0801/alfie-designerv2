import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { 
  SUPABASE_URL, 
  SUPABASE_ANON_KEY, 
  SUPABASE_SERVICE_ROLE_KEY,
  ADMIN_EMAILS 
} from "../_shared/env.ts";

import { corsHeaders } from "../_shared/cors.ts";
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response("ok", { headers: corsHeaders });
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

    const { data, error } = await supabaseAdmin.rpc('reset_stuck_jobs', { age_minutes: 5 });

    if (error) {
      console.error('[ADMIN] Error resetting stuck jobs:', error);
      return new Response(
        JSON.stringify({ error: error.message }), 
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[ADMIN] ✅ Reset stuck jobs:', data);

    return new Response(
      JSON.stringify({ 
        success: true, 
        reset_count: data || 0,
        message: `${data || 0} job(s) débloqué(s)` 
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

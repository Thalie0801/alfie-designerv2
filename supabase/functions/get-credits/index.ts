import { createClient } from "npm:@supabase/supabase-js@2";

import { corsHeaders } from "../_shared/cors.ts";
import { SUPABASE_ANON_KEY, SUPABASE_URL, validateEnv } from "../_shared/env.ts";

const envValidation = validateEnv();
if (!envValidation.valid) {
  console.error("Missing required environment variables", { missing: envValidation.missing });
}
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');

    const supabase = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
      global: {
        headers: { Authorization: authHeader },
      },
    });

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authentication' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Appeler la nouvelle fonction get-quota unifiée
    const quotaResponse = await fetch(`${SUPABASE_URL}/functions/v1/get-quota`, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    });

    if (!quotaResponse.ok) {
      const errorData = await quotaResponse.json();
      return new Response(
        JSON.stringify({ error: errorData.error || 'Failed to fetch quota' }),
        { status: quotaResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const quotaData = await quotaResponse.json();

    // Récupérer storage_days depuis plans_config
    const { data: planConfig } = await supabase
      .from('plans_config')
      .select('storage_days')
      .eq('plan', quotaData.plan || 'starter')
      .single();

    // Format de compatibilité avec l'ancien get-credits
    return new Response(
      JSON.stringify({
        plan: quotaData.plan,
        woofs_total: quotaData.woofs_quota,
        woofs_used: quotaData.woofs_used,
        woofs_remaining: quotaData.woofs_remaining,
        visuals_total: quotaData.visuals_quota,
        visuals_used: quotaData.visuals_used,
        visuals_remaining: quotaData.visuals_remaining,
        reset_date: quotaData.reset_date,
        storage_days: planConfig?.storage_days || 30,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in get-credits:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

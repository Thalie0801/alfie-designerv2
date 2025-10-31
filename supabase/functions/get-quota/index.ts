import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authentication' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { brand_id } = await req.json().catch(() => ({}));

    // 1. Lire le profil utilisateur
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('quota_videos, woofs_consumed_this_month, quota_visuals_per_month, generations_this_month, plan, generations_reset_date')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return new Response(
        JSON.stringify({ error: 'Profile not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Si brand_id fourni, utiliser les quotas de la marque
    let finalQuotas = {
      woofs_quota: profile.quota_videos ?? 0,
      woofs_used: profile.woofs_consumed_this_month ?? 0,
      visuals_quota: profile.quota_visuals_per_month ?? 0,
      visuals_used: profile.generations_this_month ?? 0,
    };

    if (brand_id) {
      const { data: brand } = await supabase
        .from('brands')
        .select('quota_woofs, woofs_used, quota_images, images_used')
        .eq('id', brand_id)
        .single();

      if (brand) {
        finalQuotas = {
          woofs_quota: brand.quota_woofs ?? finalQuotas.woofs_quota,
          woofs_used: brand.woofs_used ?? 0,
          visuals_quota: brand.quota_images ?? finalQuotas.visuals_quota,
          visuals_used: brand.images_used ?? 0,
        };
      }
    }

    // 3. Calculer les restants (JAMAIS négatifs)
    const woofs_remaining = Math.max(0, finalQuotas.woofs_quota - finalQuotas.woofs_used);
    const visuals_remaining = Math.max(0, finalQuotas.visuals_quota - finalQuotas.visuals_used);

    // 4. Date de reset (1er du mois suivant)
    const resetDate = profile.generations_reset_date || new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1).toISOString();

    return new Response(
      JSON.stringify({
        woofs_quota: finalQuotas.woofs_quota,
        woofs_used: finalQuotas.woofs_used,
        woofs_remaining,
        visuals_quota: finalQuotas.visuals_quota,
        visuals_used: finalQuotas.visuals_used,
        visuals_remaining,
        plan: profile.plan || 'starter',
        reset_date: resetDate,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in get-quota:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

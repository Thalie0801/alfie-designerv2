import { edgeHandler } from '../_shared/edgeHandler.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.2';

export default {
  async fetch(req: Request) {
    return edgeHandler(req, async ({ jwt, input }) => {
      if (!jwt) {
        throw new Error('MISSING_AUTH');
      }

      const supabaseRls = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_ANON_KEY')!,
        { global: { headers: { Authorization: `Bearer ${jwt}` } } }
      );

      const { data: { user }, error: userError } = await supabaseRls.auth.getUser();
      if (userError || !user) {
        throw new Error('INVALID_TOKEN');
      }

      const { brand_id } = input;

      // 1. Lire le profil utilisateur
      const { data: profile, error: profileError } = await supabaseRls
        .from('profiles')
        .select('quota_videos, woofs_consumed_this_month, quota_visuals_per_month, generations_this_month, plan, generations_reset_date')
        .eq('id', user.id)
        .maybeSingle();

      if (profileError || !profile) {
        console.error('Profile error:', profileError);
        throw new Error('PROFILE_NOT_FOUND');
      }

      // Defaults pour éviter null → 0 fantôme
      let finalQuotas = {
        woofs_quota: profile.quota_videos ?? 0,
        woofs_used: profile.woofs_consumed_this_month ?? 0,
        visuals_quota: profile.quota_visuals_per_month ?? 0,
        visuals_used: profile.generations_this_month ?? 0,
      };

      // Fallback sur plans_config si quotas = 0 mais plan défini
      if (finalQuotas.woofs_quota === 0 && profile.plan) {
        const { data: planConfig } = await supabaseRls
          .from('plans_config')
          .select('woofs_per_month, visuals_per_month')
          .eq('plan', profile.plan)
          .maybeSingle();
        
        if (planConfig) {
          finalQuotas.woofs_quota = planConfig.woofs_per_month;
          finalQuotas.visuals_quota = planConfig.visuals_per_month;
          console.log(`[get-quota] Fallback to plans_config for plan ${profile.plan}`);
        }
      }

      // 2. Si brand_id fourni, override avec quotas de la marque
      if (brand_id) {
        const { data: brand } = await supabaseRls
          .from('brands')
          .select('quota_woofs, woofs_used, quota_images, images_used')
          .eq('id', brand_id)
          .maybeSingle();

        if (brand) {
          finalQuotas = {
            woofs_quota: brand.quota_woofs ?? finalQuotas.woofs_quota,
            woofs_used: brand.woofs_used ?? 0,
            visuals_quota: brand.quota_images ?? finalQuotas.visuals_quota,
            visuals_used: brand.images_used ?? 0,
          };
        }
      }

      const woofs_remaining = Math.max(0, finalQuotas.woofs_quota - finalQuotas.woofs_used);
      const visuals_remaining = Math.max(0, finalQuotas.visuals_quota - finalQuotas.visuals_used);

      const resetDate = profile.generations_reset_date || 
        new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1).toISOString();

      return {
        woofs_quota: finalQuotas.woofs_quota,
        woofs_used: finalQuotas.woofs_used,
        woofs_remaining,
        visuals_quota: finalQuotas.visuals_quota,
        visuals_used: finalQuotas.visuals_used,
        visuals_remaining,
        plan: profile.plan || 'starter',
        reset_date: resetDate,
      };
    });
  }
};

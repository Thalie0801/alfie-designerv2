import { edgeHandler } from '../_shared/edgeHandler.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.2';
import { ADMIN_EMAILS } from '../_shared/env.ts';

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

      const adminEmails = (ADMIN_EMAILS ?? '')
        .split(',')
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean);

      // 1. Lire le profil utilisateur pour les quotas de base
      const { data: profile, error: profileError } = await supabaseRls
        .from('profiles')
        .select('quota_videos, quota_visuals_per_month, plan, generations_reset_date, granted_by_admin')
        .eq('id', user.id)
        .maybeSingle();

      if (profileError || !profile) {
        console.error('Profile error:', profileError);
        throw new Error('PROFILE_NOT_FOUND');
      }

      const userEmail = user.email?.toLowerCase() ?? '';
      const { data: roles } = await supabaseRls
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id);

      const isAdmin =
        adminEmails.includes(userEmail) ||
        !!roles?.some((r) => r.role === 'admin') ||
        profile.plan === 'admin' ||
        !!profile.granted_by_admin;
      const isAdmin = adminEmails.includes(userEmail) || !!roles?.some((r) => r.role === 'admin');

      // 2. ✅ FIX: Calculer la période actuelle YYYYMM
      const now = new Date();
      const periodYYYYMM = parseInt(
        now.getFullYear().toString() + 
        (now.getMonth() + 1).toString().padStart(2, '0')
      );

      // Defaults pour éviter null → 0 fantôme
      let finalQuotas = {
        woofs_quota: profile.quota_videos ?? 0,
        woofs_used: 0,
        visuals_quota: profile.quota_visuals_per_month ?? 0,
        visuals_used: 0,
        videos_quota: 0,
        videos_used: 0,
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

      // 3. Si brand_id fourni, lire depuis counters_monthly (source de vérité)
      if (brand_id) {
        const { data: brand } = await supabaseRls
          .from('brands')
          .select('quota_woofs, quota_images, quota_videos')
          .eq('id', brand_id)
          .maybeSingle();

        const { data: counter } = await supabaseRls
          .from('counters_monthly')
          .select('images_used, reels_used, woofs_used')
          .eq('brand_id', brand_id)
          .eq('period_yyyymm', periodYYYYMM)
          .maybeSingle();

        if (brand) {
          finalQuotas = {
            woofs_quota: brand.quota_woofs ?? finalQuotas.woofs_quota,
            woofs_used: counter?.woofs_used ?? 0,
            visuals_quota: brand.quota_images ?? finalQuotas.visuals_quota,
            visuals_used: counter?.images_used ?? 0,
            videos_quota: brand.quota_videos ?? 0,
            videos_used: counter?.reels_used ?? 0,
          };
          console.log(`[get-quota] Using counters_monthly for brand ${brand_id}, period ${periodYYYYMM}`);
        }
      }

      if (isAdmin) {
        const unlimited = 1_000_000_000;
        finalQuotas = {
          ...finalQuotas,
          woofs_quota: unlimited,
          visuals_quota: unlimited,
          videos_quota: unlimited,
        };
      }

      const woofs_remaining = Math.max(0, finalQuotas.woofs_quota - finalQuotas.woofs_used);
      const visuals_remaining = Math.max(0, finalQuotas.visuals_quota - finalQuotas.visuals_used);
      const videos_remaining = Math.max(0, finalQuotas.videos_quota - finalQuotas.videos_used);

      const resetDate = profile.generations_reset_date || 
        new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1).toISOString();

      return {
        woofs_quota: finalQuotas.woofs_quota,
        woofs_used: finalQuotas.woofs_used,
        woofs_remaining,
        visuals_quota: finalQuotas.visuals_quota,
        visuals_used: finalQuotas.visuals_used,
        visuals_remaining,
        videos_quota: finalQuotas.videos_quota,
        videos_used: finalQuotas.videos_used,
        videos_remaining,
        plan: profile.plan || 'starter',
        reset_date: resetDate,
        is_admin: isAdmin,
      };
    });
  }
};

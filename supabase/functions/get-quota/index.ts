import { edgeHandler } from '../_shared/edgeHandler.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.2';
import { isAdminUser } from '../_shared/auth.ts';
import { SUPABASE_ANON_KEY, SUPABASE_URL, validateEnv } from '../_shared/env.ts';

const envValidation = validateEnv();
if (!envValidation.valid) {
  console.error('Missing required environment variables', { missing: envValidation.missing });
}

export default {
  async fetch(req: Request) {
    return edgeHandler(req, async ({ jwt, input }) => {
      if (!jwt) {
        throw new Error('MISSING_AUTH');
      }

      const supabaseRls = createClient(
        SUPABASE_URL!,
        SUPABASE_ANON_KEY!,
        { global: { headers: { Authorization: `Bearer ${jwt}` } } }
      );

      const { data: { user }, error: userError } = await supabaseRls.auth.getUser();
      if (userError || !user) {
        throw new Error('INVALID_TOKEN');
      }

      const { brand_id } = input;

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

      const isAdmin = isAdminUser(userEmail, roles, {
        plan: profile.plan,
        grantedByAdmin: profile.granted_by_admin,
      });

      // 2. ✅ FIX: Calculer la période actuelle YYYYMM
      const now = new Date();
      const periodYYYYMM = parseInt(
        now.getFullYear().toString() + 
        (now.getMonth() + 1).toString().padStart(2, '0')
      );

      // Système unifié Woofs : tout est en Woofs maintenant
      let woofs_quota = profile.quota_videos ?? 0;
      let woofs_used = 0;

      // Fallback sur plans_config si quotas = 0 mais plan défini
      if (woofs_quota === 0 && profile.plan) {
        const { data: planConfig } = await supabaseRls
          .from('plans_config')
          .select('woofs_per_month')
          .eq('plan', profile.plan)
          .maybeSingle();
        
        if (planConfig) {
          woofs_quota = planConfig.woofs_per_month;
          console.log(`[get-quota] Fallback to plans_config for plan ${profile.plan}`);
        }
      }

      // 3. Si brand_id fourni, lire depuis counters_monthly (source de vérité)
      if (brand_id) {
        const { data: brand } = await supabaseRls
          .from('brands')
          .select('quota_woofs, resets_on')
          .eq('id', brand_id)
          .maybeSingle();

        const { data: counter } = await supabaseRls
          .from('counters_monthly')
          .select('woofs_used')
          .eq('brand_id', brand_id)
          .eq('period_yyyymm', periodYYYYMM)
          .maybeSingle();

        if (brand) {
          woofs_quota = brand.quota_woofs ?? woofs_quota;
          woofs_used = counter?.woofs_used ?? 0;
          console.log(`[get-quota] Using counters_monthly for brand ${brand_id}, period ${periodYYYYMM}`);
        }
      }

      if (isAdmin) {
        const unlimited = 1_000_000_000;
        console.log(`[quota] admin bypass applied for ${userEmail}`);
        woofs_quota = unlimited;
      }

      const woofs_remaining = Math.max(0, woofs_quota - woofs_used);
      const threshold_80 = (woofs_used / woofs_quota) >= 0.8;

      const resetDate = profile.generations_reset_date || 
        new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1).toISOString();

      return {
        woofs_quota,
        woofs_used,
        woofs_remaining,
        threshold_80,
        plan: profile.plan || 'starter',
        reset_date: resetDate,
        is_admin: isAdmin,
      };
    });
  }
};

import { edgeHandler } from '../_shared/edgeHandler.ts';
import { createClient } from "npm:@supabase/supabase-js@2";
import { isAdminUser } from '../_shared/auth.ts';
import { SUPABASE_ANON_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, validateEnv } from '../_shared/env.ts';

const envValidation = validateEnv();
if (!envValidation.valid) {
  console.error('Missing required environment variables', { missing: envValidation.missing });
}

// Client admin pour les lectures internes (bypass RLS)
const adminClient = createClient(
  SUPABASE_URL ?? "",
  SUPABASE_SERVICE_ROLE_KEY ?? "",
  { auth: { autoRefreshToken: false, persistSession: false } }
);

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
      console.log(`[get-quota] Request for brand_id=${brand_id}, user=${user.email}`);

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

      // 2. Calculer la période actuelle YYYYMM
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
          console.log(`[get-quota] Fallback to plans_config for plan ${profile.plan}: ${woofs_quota} woofs`);
        }
      }

      // 3. Si brand_id fourni, lire depuis counters_monthly avec admin client (bypass RLS)
      if (brand_id) {
        const { data: brand, error: brandError } = await supabaseRls
          .from('brands')
          .select('quota_woofs, resets_on')
          .eq('id', brand_id)
          .maybeSingle();

        console.log(`[get-quota] Brand lookup:`, { brand, brandError });

        // ✅ Utiliser admin client pour lire counters_monthly (bypass RLS)
        const { data: counter, error: counterError } = await adminClient
          .from('counters_monthly')
          .select('woofs_used')
          .eq('brand_id', brand_id)
          .eq('period_yyyymm', periodYYYYMM)
          .maybeSingle();

        console.log(`[get-quota] Counter query (admin):`, { counter, counterError, brand_id, periodYYYYMM });

        if (brand) {
          woofs_quota = brand.quota_woofs ?? woofs_quota;
          woofs_used = counter?.woofs_used ?? 0;
          console.log(`[get-quota] Using counters_monthly for brand ${brand_id}, period ${periodYYYYMM}: used=${woofs_used}, quota=${woofs_quota}`);
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

      console.log(`[get-quota] Final response: woofs_used=${woofs_used}, woofs_quota=${woofs_quota}, woofs_remaining=${woofs_remaining}`);

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

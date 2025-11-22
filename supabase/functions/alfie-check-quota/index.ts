import { edgeHandler } from '../_shared/edgeHandler.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.2';
import { isAdminUser } from '../_shared/auth.ts';

export default {
  async fetch(req: Request) {
    return edgeHandler(req, async ({ jwt, input }) => {
      if (!jwt) throw new Error('MISSING_AUTH');

      const { cost_woofs, brand_id } = input;
      if (!cost_woofs) throw new Error('MISSING_COST');

      // Appel INTERNE via Supabase client (pas fetch HTTP)
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_ANON_KEY')!,
        { global: { headers: { Authorization: `Bearer ${jwt}` } } }
      );

      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        throw new Error('INVALID_TOKEN');
      }

      const { data: roleRows } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id);

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('plan, granted_by_admin')
        .eq('id', user.id)
        .maybeSingle();

      if (profileError) {
        console.error('[alfie-check-quota] profile lookup failed', profileError);
      }

      const isAdmin = isAdminUser(user.email, roleRows, {
        plan: profile?.plan,
        grantedByAdmin: profile?.granted_by_admin,
        logContext: 'quota',
      });

      if (isAdmin) {
        const unlimited = 1_000_000_000;
        console.log(`[quota] admin bypass applied for ${user.email ?? 'unknown-email'}`);
        return {
          ok: true,
          remaining: unlimited,
          quota_total: unlimited,
          new_balance_if_ok: unlimited,
          reason: 'admin-bypass',
          is_admin: true,
        };
      }

      const { data: quotaData, error: quotaError } = await supabase.functions.invoke('get-quota', {
        body: { brand_id },
      });

      if (quotaError || !quotaData?.ok) {
        console.error('Quota check failed:', quotaError, quotaData);
        throw new Error(quotaData?.error || 'QUOTA_CHECK_FAILED');
      }

      const quota = quotaData.data;
      const remaining = quota.woofs_remaining;
      const ok = remaining >= cost_woofs;

      return {
        ok,
        remaining,
        quota_total: quota.woofs_quota,
        new_balance_if_ok: ok ? remaining - cost_woofs : remaining,
        is_admin: quota.is_admin ?? false,
      };
    });
  }
};

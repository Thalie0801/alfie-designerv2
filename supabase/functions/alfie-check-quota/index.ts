import { edgeHandler } from '../_shared/edgeHandler.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.2';
import { ADMIN_EMAILS } from '../_shared/env.ts';

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

      const adminEmails = (ADMIN_EMAILS ?? '')
        .split(',')
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean);

      const { data: roleRows } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id);

      const isAdmin = adminEmails.includes((user.email || '').toLowerCase()) || !!roleRows?.some((r) => r.role === 'admin');

      if (isAdmin) {
        const unlimited = 1_000_000_000;
        return {
          ok: true,
          remaining: unlimited,
          quota_total: unlimited,
          new_balance_if_ok: unlimited,
          reason: 'admin-bypass'
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
      };
    });
  }
};

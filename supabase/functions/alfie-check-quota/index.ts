import { edgeHandler } from '../_shared/edgeHandler.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.2';

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

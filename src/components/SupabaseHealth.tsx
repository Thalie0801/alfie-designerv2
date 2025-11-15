import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export function SupabaseHealth() {
  const [envOk, setEnvOk] = useState<boolean | null>(null);
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setEnvOk(Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY));

    (async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        setSessionEmail(session?.user?.email ?? null);
      } catch (err) {
        if (err instanceof Error) {
          setError(err.message);
        } else {
          setError('Unknown error');
        }
      }
    })();
  }, []);

  return (
    <div
      style={{
        fontFamily: 'monospace',
        padding: 12,
        border: '1px solid #ddd',
        borderRadius: 8,
        marginTop: 16,
      }}
    >
      <div>ENV: {envOk ? '✅' : '❌'} (URL/ANON)</div>
      <div>Session: {sessionEmail ?? '—'}</div>
      {error && <div style={{ color: 'crimson' }}>Error: {error}</div>}
    </div>
  );
}

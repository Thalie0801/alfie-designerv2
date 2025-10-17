import { supabase } from '@/integrations/supabase/client';

export async function getAuthHeader() {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const userToken = session?.access_token;
  const anonToken = import.meta.env.VITE_SUPABASE_ANON_KEY ?? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  const token = userToken ?? anonToken;

  if (!token) {
    throw new Error('Supabase credentials are missing.');
  }

  return { Authorization: `Bearer ${token}` };
}

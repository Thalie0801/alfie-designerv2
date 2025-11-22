import { supabase } from '@/integrations/supabase/client';
import { env } from '@/config/env';

export async function getAuthHeader() {
  if (!supabase || !env.VITE_SUPABASE_ANON_KEY) {
    console.error('[Auth] Configuration Supabase manquante');
    throw new Error('Configuration Supabase manquante (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY).');
  }

  try {
    const {
      data: { session },
      error: sessionError
    } = await supabase.auth.getSession();

    if (sessionError) {
      console.error('Session error:', sessionError);
      throw new Error('Session expirée. Veuillez vous reconnecter.');
    }

    const userToken = session?.access_token ?? null;
    const anonToken = env.VITE_SUPABASE_ANON_KEY;

    if (!anonToken) {
      throw new Error('Configuration Supabase manquante (VITE_SUPABASE_ANON_KEY).');
    }

    if (!userToken) {
      throw new Error('Authentification requise. Veuillez vous reconnecter.');
    }

    const headers: Record<string, string> = {
      Authorization: `Bearer ${userToken}`,
      apikey: anonToken,
    };

    return headers;
  } catch (error) {
    console.error('Auth header error:', error);
    if (error instanceof Error && error.message.includes('Refresh Token')) {
      throw new Error('Session expirée. Veuillez vous reconnecter.');
    }
    throw error;
  }
}

import { supabase } from '@/lib/supabaseSafeClient';

export async function getAuthHeader() {
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
    const anonToken =
      import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
      import.meta.env.VITE_SUPABASE_ANON_KEY;

    if (!anonToken || !userToken) {
      throw new Error('Authentification requise. Veuillez vous reconnecter.');
    }

    const headers: Record<string, string> = {
      Authorization: `Bearer ${userToken}`
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

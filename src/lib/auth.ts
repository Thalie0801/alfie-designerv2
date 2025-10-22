import { supabase } from '@/integrations/supabase/client';

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

    const userToken = session?.access_token;
    const anonToken =
      import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
      import.meta.env.VITE_SUPABASE_ANON_KEY;
    const token = userToken ?? anonToken;

    if (!token) {
      throw new Error('Authentification requise. Veuillez vous reconnecter.');
    }

    return { Authorization: `Bearer ${token}` };
  } catch (error) {
    console.error('Auth header error:', error);
    if (error instanceof Error && error.message.includes('Refresh Token')) {
      throw new Error('Session expirée. Veuillez vous reconnecter.');
    }
    throw error;
  }
}

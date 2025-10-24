import { supabase } from '@/integrations/supabase/client';
import { isAdmin } from '@/lib/config/admin';
import { adminCreateUser, type CreateUserParams } from '@/lib/admin-api';

export async function createUser(params: CreateUserParams) {
  try {
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      throw new Error('Non authentifié');
    }

    if (!isAdmin(user.email)) {
      throw new Error('Accès refusé : droits administrateur requis');
    }

    return await adminCreateUser(params);
  } catch (error: any) {
    console.error('Error in createUser action:', error);
    throw error;
  }
}

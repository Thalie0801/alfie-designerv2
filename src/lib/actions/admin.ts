import { supabase } from '@/lib/supabase';
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

    // Vérifier le rôle admin via la table user_roles
    const { data: rolesData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);

    const hasAdminRole = rolesData?.some(r => r.role === 'admin');
    
    if (!hasAdminRole) {
      throw new Error('Accès refusé : droits administrateur requis');
    }

    return await adminCreateUser(params);
  } catch (error: any) {
    console.error('Error in createUser action:', error);
    throw error;
  }
}

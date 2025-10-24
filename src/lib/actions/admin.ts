import { supabase } from '@/integrations/supabase/client';
import { isAdmin } from '@/lib/config/admin';

interface CreateUserParams {
  email: string;
  fullName?: string;
  plan: string;
  sendInvite: boolean;
  password?: string;
}

export async function createUser(params: CreateUserParams) {
  try {
    // Vérifier que l'utilisateur actuel est authentifié
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      throw new Error('Non authentifié');
    }

    if (!isAdmin(user.email)) {
      throw new Error('Accès refusé : droits administrateur requis');
    }

    // Appeler l'Edge Function
    const { data, error } = await supabase.functions.invoke('admin-create-user', {
      body: {
        email: params.email,
        fullName: params.fullName,
        plan: params.plan,
        sendInvite: params.sendInvite,
        password: params.password,
      }
    });

    if (error) {
      console.error('Error from Edge Function:', error);
      throw new Error(error.message || 'Erreur lors de la création de l\'utilisateur');
    }

    return data;
  } catch (error: any) {
    console.error('Error in createUser action:', error);
    throw error;
  }
}

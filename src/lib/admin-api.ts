import { supabase } from '@/integrations/supabase/client';

interface CreateUserParams {
  email: string;
  fullName?: string;
  plan: string;
  sendInvite: boolean;
  password?: string;
}

export async function adminCreateUser(params: CreateUserParams) {
  const { data, error } = await supabase.functions.invoke('admin-create-user', {
    body: params,
  });

  if (error) {
    console.error('Error creating user:', error);
    throw new Error(error.message || "Erreur lors de la création de l'utilisateur");
  }

  return data;
}

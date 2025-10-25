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
    body: {
      email: params.email,
      fullName: params.fullName,
      plan: params.plan,
      sendInvite: params.sendInvite,
      password: params.password,
    },
  });

  if (error) {
    console.error('Error invoking admin-create-user:', error);
    throw new Error(error.message || "Erreur lors de l'appel à l'Edge Function admin-create-user");
  }

  return data;
}

export type { CreateUserParams };

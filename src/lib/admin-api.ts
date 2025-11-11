import { supabase } from '@/integrations/supabase/client';

interface CreateUserParams {
  email: string;
  fullName?: string;
  plan: string;
  sendInvite: boolean;
  grantedByAdmin?: boolean;
  password?: string;
}

export async function adminCreateUser(params: CreateUserParams) {
  console.debug('[admin-api] Calling admin-create-user with:', { 
    email: params.email, 
    plan: params.plan,
    sendInvite: params.sendInvite,
    grantedByAdmin: params.grantedByAdmin 
  });

  const { data, error } = await supabase.functions.invoke('admin-create-user', {
    body: {
      email: params.email,
      fullName: params.fullName,
      plan: params.plan,
      sendInvite: params.sendInvite,
      grantedByAdmin: params.grantedByAdmin,
      password: params.password,
    },
  });

  if (error) {
    console.error('[admin-api] Error invoking admin-create-user:', error);
    throw new Error(error.message || "Erreur lors de l'appel à l'Edge Function admin-create-user");
  }

  console.debug('[admin-api] Success:', data);
  return data;
}

export type { CreateUserParams };

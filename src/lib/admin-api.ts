import { createUser } from './actions/admin';

interface CreateUserParams {
  email: string;
  fullName?: string;
  plan: string;
  sendInvite: boolean;
  password?: string;
}

export async function adminCreateUser(params: CreateUserParams) {
  return await createUser(params);
}

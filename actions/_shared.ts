import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function parseCookies(cookieHeader: string | null): Record<string, string> {
  if (!cookieHeader) return {};
  return cookieHeader.split(';').reduce<Record<string, string>>((acc, part) => {
    const [key, ...rest] = part.trim().split('=');
    if (!key) return acc;
    acc[key] = decodeURIComponent(rest.join('='));
    return acc;
  }, {});
}

async function resolveUserFromToken(token: string | undefined) {
  if (!token) return null;
  try {
    const { data, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !data?.user) return null;
    const user = data.user;

    const { data: rolesData } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);

    const roles = Array.isArray(rolesData) ? rolesData.map((r) => r.role) : [];
    const isAdmin = roles.includes('admin') || (user.email ? ['nathaliestaelens@gmail.com','staelensnathalie@gmail.com'].includes(user.email) : false);

    return {
      id: user.id,
      role: isAdmin ? 'admin' as const : 'user' as const,
      email: user.email ?? undefined,
    };
  } catch (error) {
    console.error('resolveUserFromToken error:', error);
    return null;
  }
}

export async function getCurrentUser(req: Request): Promise<{ id: string; role: 'admin' | 'user'; email?: string } | null> {
  const headerUser = req.headers.get('x-user') ?? req.headers.get('x-lovable-user');
  if (headerUser) {
    try {
      const parsed = JSON.parse(headerUser);
      if (parsed && typeof parsed.id === 'string' && parsed.role) {
        return {
          id: parsed.id,
          role: parsed.role === 'admin' ? 'admin' : 'user',
          email: typeof parsed.email === 'string' ? parsed.email : undefined,
        };
      }
    } catch (error) {
      console.warn('Failed to parse x-user header', error);
    }
  }

  const authHeader = req.headers.get('Authorization') ?? req.headers.get('authorization');
  const bearer = authHeader?.startsWith('Bearer ')
    ? authHeader.slice('Bearer '.length).trim()
    : undefined;

  const cookies = parseCookies(req.headers.get('Cookie') ?? req.headers.get('cookie'));
  const cookieToken = cookies['sb-access-token'] ?? cookies['supabase-access-token'];

  return resolveUserFromToken(bearer ?? cookieToken ?? undefined);
}

export async function isAdminOrThrow(req: Request) {
  const me = await getCurrentUser(req);
  if (!me || me.role !== 'admin') {
    throw new Response('Forbidden', { status: 403 });
  }
}

export async function upsertProfilePlan(userId: string, email: string, plan: string) {
  const { error } = await supabaseAdmin.from('profiles').upsert(
    { user_id: userId, email, plan },
    { onConflict: 'user_id' }
  );
  if (error) throw error;
}

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Load admin emails from environment variable - NEVER hardcode in source
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '')
  .split(',')
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

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
    const normalizedEmail = user.email?.toLowerCase();
    const isAdmin =
      roles.includes('admin') ||
      (normalizedEmail ? ADMIN_EMAILS.includes(normalizedEmail) : false);

    return {
      id: user.id,
      role: isAdmin ? ('admin' as const) : ('user' as const),
      email: normalizedEmail ?? undefined,
    };
  } catch (error) {
    console.error('resolveUserFromToken error:', error);
    return null;
  }
}

export async function getCurrentUser(
  req: Request
): Promise<{ id: string; role: 'admin' | 'user'; email?: string } | null> {
  // SECURITY: Only trust JWT tokens - never trust client-provided headers
  // The x-user-email and x-user headers have been removed as they can be forged
  
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

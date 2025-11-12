import { supabase } from '@/integrations/supabase/client';

// Cache pour éviter les appels répétés
const roleCache = new Map<string, { roles: string[], timestamp: number }>();
const CACHE_TTL = 60000; // 1 minute

/**
 * Récupère les rôles d'un utilisateur depuis la base de données
 * Utilise un cache pour optimiser les performances
 */
export async function getUserRoles(userId: string): Promise<string[]> {
  const cached = roleCache.get(userId);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.roles;
  }

  const { data, error } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', userId);

  if (error || !data) {
    console.error('[Access] Error fetching roles:', error);
    return [];
  }

  const roles = data.map(r => r.role);
  roleCache.set(userId, { roles, timestamp: Date.now() });
  return roles;
}

/**
 * Vérifie si un utilisateur a le rôle VIP
 */
export async function isVip(userId: string): Promise<boolean> {
  const roles = await getUserRoles(userId);
  return roles.includes('vip');
}

/**
 * Vérifie si un utilisateur a le rôle Admin
 */
export async function isAdmin(userId: string): Promise<boolean> {
  const roles = await getUserRoles(userId);
  return roles.includes('admin');
}

/**
 * Vérifie si un utilisateur a le rôle VIP ou Admin
 */
export async function isVipOrAdmin(userId: string): Promise<boolean> {
  const roles = await getUserRoles(userId);
  return roles.includes('vip') || roles.includes('admin');
}

/**
 * Version synchrone pour vérifier si un rôle est présent
 * À utiliser quand les rôles ont déjà été chargés
 */
export function hasRole(roles: string[], targetRole: string): boolean {
  return roles.includes(targetRole);
}

/**
 * Efface le cache des rôles pour un utilisateur
 * Utile après une modification des rôles
 */
export function clearRoleCache(userId?: string) {
  if (userId) {
    roleCache.delete(userId);
  } else {
    roleCache.clear();
  }
}

/**
 * Vérifie si un utilisateur peut utiliser une fonctionnalité
 * Les VIP et Admin ont accès à TOUTES les fonctionnalités (bypass)
 */
export function canUseFeature(
  feature: string,
  user: { roles?: string[]; plan?: string } | null,
  flags?: Record<string, any>
): boolean {
  // Bypass total pour VIP/Admin
  const roles = new Set(user?.roles ?? []);
  const willBypass = roles.has('admin') || roles.has('vip');
  
  // ✅ SECURITY: Logs removed to prevent authorization info leakage
  if (import.meta.env.DEV) {
    console.debug('[canUseFeature]', { feature, willBypass });
  }
  
  if (willBypass) {
    return true;
  }

  // Pour les autres utilisateurs, vérifier les feature flags
  const ff = flags?.[feature];
  if (!ff) return false;

  return (
    ff.allowed_plans?.includes(user?.plan ?? 'free') ||
    ff.allowed_roles?.some((r: string) => roles.has(r))
  );
}

/**
 * ============================================================================
 * WHITELIST VIP - Comptes clients exceptionnels
 * ============================================================================
 * 
 * Certains clients bénéficient d'un accès garanti au dashboard,
 * indépendamment de leur statut d'abonnement.
 * 
 * Pour ajouter un nouveau compte VIP, ajouter l'email ci-dessous.
 * Voir docs/WHITELIST_VIP.md pour plus de détails.
 */

export const FORCE_DASHBOARD_EMAILS = new Set([
  'sandrine.guedra@gmail.com',
  'sandrine.guedra54@gmail.com',
  'borderonpatricia7@gmail.com', // Correction: email correct
  'patriciaborderon7@gamil.com', // Gardé pour rétro-compatibilité
  'nathaliestaelens@gmail.com', // Admin
]);

/**
 * Normalise un email pour comparaison (trim + lowercase)
 */
export function normalizeEmail(email?: string | null): string {
  return (email ?? '').trim().toLowerCase();
}

/**
 * Vérifie si un utilisateur est dans la whitelist VIP
 */
export function isVIPUser(email?: string | null): boolean {
  const emailNorm = normalizeEmail(email);
  return FORCE_DASHBOARD_EMAILS.has(emailNorm);
}

/**
 * Calcule le flag d'autorisation effectif
 * (autorisé normalement OU dans la whitelist VIP)
 */
export function getEffectiveAuthorization(
  isAuthorized: boolean,
  userEmail?: string | null
): boolean {
  return isAuthorized || isVIPUser(userEmail);
}

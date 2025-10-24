// Configuration des emails admin
export const ADMIN_EMAILS = [
  'nathaliestaelens@gmail.com',
];

/**
 * Vérifie si un email a les droits administrateur
 */
export function isAdmin(email: string | undefined | null): boolean {
  if (!email) return false;
  return ADMIN_EMAILS.includes(email);
}

/**
 * Vérifie si l'utilisateur actuel est admin
 */
export function checkAdminAccess(userEmail: string | undefined | null): void {
  if (!isAdmin(userEmail)) {
    throw new Error('Accès refusé : droits administrateur requis');
  }
}

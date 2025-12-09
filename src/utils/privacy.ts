/**
 * Utilitaires de confidentialité RGPD
 * Masquage des données personnelles pour l'affichage
 */

/**
 * Masque un email pour affichage RGPD-compliant (utilisateurs)
 * Exemple: "patricia.borderon@gmail.com" → "p***************n@gmail.com"
 */
export function maskEmail(email: string): string {
  if (!email || !email.includes('@')) return '***@***';
  const [local, domain] = email.split('@');
  if (local.length <= 2) {
    return `**@${domain}`;
  }
  const maskedLocal = `${local[0]}${'*'.repeat(Math.min(local.length - 2, 15))}${local[local.length - 1]}`;
  return `${maskedLocal}@${domain}`;
}

/**
 * Masque partiel pour contexte admin (révélation possible)
 * Exemple: "patricia.borderon@gmail.com" → "pat***@gmail.com"
 */
export function maskEmailPartial(email: string): string {
  if (!email || !email.includes('@')) return '***@***';
  const [local, domain] = email.split('@');
  const visible = Math.min(3, local.length);
  return `${local.substring(0, visible)}***@${domain}`;
}

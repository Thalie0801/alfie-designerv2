export const ADMIN_EMAILS = [
  'nathaliestaelens@gmail.com', // ← Votre email admin
]

export function isAdmin(email: string | undefined): boolean {
  return ADMIN_EMAILS.includes(email || '')
}

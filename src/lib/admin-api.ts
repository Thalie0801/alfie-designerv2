export async function adminCreateUser(input: {
  email: string;
  fullName?: string;
  plan: 'starter' | 'pro' | 'studio';
  sendInvite?: boolean;
  password?: string;
}) {
  const r = await fetch('/actions/admin.createUser', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(input),
  });
  if (!r.ok) {
    const msg = await r.text().catch(() => '');
    throw new Error(msg || 'admin.createUser failed');
  }
  return r.json() as Promise<{ ok: true; userId: string }>;
}

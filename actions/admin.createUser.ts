import { isAdminOrThrow, supabaseAdmin, upsertProfilePlan } from './_shared';
import { isValidPlan } from '@/lib/plans';

export default async function handler(req: Request) {
  await isAdminOrThrow(req);

  const { email, fullName, plan, sendInvite = true, password } = await req.json().catch(() => ({}));

  if (!email || !isValidPlan(String(plan))) {
    return new Response('Bad request', { status: 400 });
  }

  const createPayload: any = { email: String(email) };
  if (sendInvite) {
    createPayload.email_confirm = false;
  } else {
    if (!password) return new Response('Password required when sendInvite=false', { status: 400 });
    createPayload.password = String(password);
    createPayload.email_confirm = true;
  }

  if (fullName) {
    createPayload.user_metadata = { full_name: String(fullName) };
  }

  const { data, error } = await supabaseAdmin.auth.admin.createUser(createPayload);
  if (error || !data?.user?.id) {
    return new Response(error?.message || 'createUser failed', { status: 500 });
  }

  const userId = data.user.id;

  if (sendInvite) {
    const { error: invErr } = await supabaseAdmin.auth.admin.inviteUserByEmail(email);
    if (invErr) {
      console.error('Invite error:', invErr.message);
    }
  }

  try {
    await upsertProfilePlan(userId, email, String(plan));
  } catch (e: any) {
    console.error('upsertProfilePlan error:', e?.message || e);
    return new Response('Failed to set plan on profile', { status: 500 });
  }

  return new Response(JSON.stringify({ ok: true, userId }), {
    headers: { 'Content-Type': 'application/json' },
  });
}

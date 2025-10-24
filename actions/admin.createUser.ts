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

  let userId = data?.user?.id ?? null;
  let existed = false;

  if (error) {
    const message = error.message?.toLowerCase() ?? '';
    if (message.includes('already')) {
      existed = true;
    } else {
      console.error('createUser error:', error.message);
    }
  }

  if (!userId) {
    const { data: existing, error: lookupError } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 1,
      email: String(email),
    });

    if (lookupError) {
      console.error('listUsers error:', lookupError.message);
    }

    const existingUserId = existing?.users?.[0]?.id;
    if (existingUserId) {
      userId = existingUserId;
      existed = true;
    }
  }

  if (!userId) {
    return new Response(error?.message || 'createUser failed', { status: 500 });
  }

  if (sendInvite && !existed) {
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

  return new Response(JSON.stringify({ ok: true, userId, existed }), {
    headers: { 'Content-Type': 'application/json' },
  });
}

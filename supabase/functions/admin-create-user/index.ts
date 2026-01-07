import { z } from "zod";
import {
  supabaseAdmin,
  supabaseUserFromReq,
  getAuthUserId,
  assertIsAdmin,
  json,
} from "../_shared/utils/admin.ts";
import { CreateUserBody } from "../_shared/validation.ts";

import { corsHeaders } from "../_shared/cors.ts";
// ✅ Plans autorisés (empêche les valeurs inattendues côté front)
const PlanEnum = z.enum(["starter", "pro", "studio", "enterprise", "none"]);
const CreateUserBodyPatched = CreateUserBody.extend({ plan: PlanEnum });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    console.log('[admin-create-user] Request received');
    
    // 1) Auth + droit admin (source de vérité backend)
    const userId = await getAuthUserId(req);
    if (!userId) {
      console.error('[admin-create-user] No user ID found');
      return json({ error: "Non authentifié" }, 401);
    }
    console.log('[admin-create-user] User ID:', userId);

    const clientUser = supabaseUserFromReq(req);
    const isAdmin = await assertIsAdmin(clientUser, userId);
    if (!isAdmin) {
      console.error('[admin-create-user] User is not admin:', userId);
      return json({ error: "Interdit" }, 403);
    }
    console.log('[admin-create-user] Admin check passed');

    // 2) Validation input
    const body = await req.json();
    console.log('[admin-create-user] Request body:', { email: body.email, plan: body.plan });
    
    const parsed = CreateUserBodyPatched.parse(body);

    if (parsed.sendInvite === false && !parsed.password) {
      return json({ error: "Mot de passe requis si sendInvite = false" }, 400);
    }

    const admin = supabaseAdmin();

    // 3) Création utilisateur (ou récupération si déjà existant)
    let finalUserId: string | null = null;

    console.log('[admin-create-user] Creating user:', parsed.email);
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email: parsed.email,
      password: parsed.password ?? crypto.randomUUID(),
      email_confirm: !!parsed.password, // si password fourni: email confirmé => login direct
      user_metadata: { full_name: parsed.fullName ?? "" },
    });

    if (created?.user?.id) {
      console.log('[admin-create-user] User created successfully:', created.user.id);
      finalUserId = created.user.id;
    } else {
      // Si l'email existe déjà, on rattache le profil et on continue (idempotent)
      console.log('[admin-create-user] User creation error:', createErr);
      const msg = (createErr?.message ?? "").toLowerCase();
      if (createErr?.status === 422 || msg.includes("already") || msg.includes("registered")) {
        console.log('[admin-create-user] User already exists, fetching existing user');
        const { data: list, error: listErr } = await admin.auth.admin.listUsers();
        if (listErr) {
          console.error('[admin-create-user] Error listing users:', listErr);
          return json({ error: listErr.message }, 500);
        }
        const existing = list?.users?.find(
          (u) => u.email?.toLowerCase() === parsed.email.toLowerCase()
        );
        if (!existing) {
          console.error('[admin-create-user] User not found in list');
          return json({ error: createErr?.message ?? "Création échouée" }, 500);
        }
        console.log('[admin-create-user] Found existing user:', existing.id);
        finalUserId = existing.id;
      } else {
        console.error('[admin-create-user] Unexpected error:', createErr);
        return json({ error: createErr?.message ?? "Création échouée" }, 500);
      }
    }

    // 4) Upsert profil (plan + accès)
    console.log('[admin-create-user] Upserting profile for user:', finalUserId);
    const { error: upErr } = await admin.from("profiles").upsert({
      id: finalUserId!,
      email: parsed.email,
      full_name: parsed.fullName ?? null,
      plan: parsed.plan,
      granted_by_admin: parsed.grantedByAdmin ?? true,
    });
    if (upErr) {
      console.error('[admin-create-user] Error upserting profile:', upErr);
      return json({ error: upErr.message }, 500);
    }
    console.log('[admin-create-user] Profile upserted successfully');

    // 5) Invitation best-effort (ne bloque pas si SMTP non configuré)
    if (parsed.sendInvite) {
      try {
        console.log('[admin-create-user] Sending invitation email');
        await admin.auth.admin.inviteUserByEmail(parsed.email);
        console.log('[admin-create-user] Invitation sent');
      } catch (err) {
        console.warn('[admin-create-user] Error sending invitation (non-blocking):', err);
      }
    }

    // 6) Réponse clean
    console.log('[admin-create-user] User creation completed successfully');
    return json({ success: true, user_id: finalUserId });
  } catch (e) {
    console.error('[admin-create-user] Unexpected error:', e);
    if (e instanceof z.ZodError) return json({ error: e.issues }, 400);
    return json({ error: (e as Error).message ?? "Erreur inconnue" }, 500);
  }
});

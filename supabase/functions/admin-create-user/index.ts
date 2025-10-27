import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import {
  supabaseAdmin,
  supabaseUserFromReq,
  getAuthUserId,
  assertIsAdmin,
  corsHeaders,
  json,
} from "../_shared/utils/admin.ts";
import { CreateUserBody } from "../_shared/validation.ts";

// ✅ Plans autorisés (empêche les valeurs inattendues côté front)
const PlanEnum = z.enum(["starter", "pro", "studio", "enterprise", "none"]);
const CreateUserBodyPatched = CreateUserBody.extend({ plan: PlanEnum });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    // 1) Auth + droit admin (source de vérité backend)
    const userId = await getAuthUserId(req);
    if (!userId) return json({ error: "Non authentifié" }, 401);

    const clientUser = supabaseUserFromReq(req);
    const isAdmin = await assertIsAdmin(clientUser, userId);
    if (!isAdmin) return json({ error: "Interdit" }, 403);

    // 2) Validation input
    const body = await req.json();
    const parsed = CreateUserBodyPatched.parse(body);

    if (parsed.sendInvite === false && !parsed.password) {
      return json({ error: "Mot de passe requis si sendInvite = false" }, 400);
    }

    const admin = supabaseAdmin();

    // 3) Création utilisateur (ou récupération si déjà existant)
    let finalUserId: string | null = null;

    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email: parsed.email,
      password: parsed.password ?? crypto.randomUUID(),
      email_confirm: !!parsed.password, // si password fourni: email confirmé => login direct
      user_metadata: { full_name: parsed.fullName ?? "" },
    });

    if (created?.user?.id) {
      finalUserId = created.user.id;
    } else {
      // Si l'email existe déjà, on rattache le profil et on continue (idempotent)
      const msg = (createErr?.message ?? "").toLowerCase();
      if (createErr?.status === 422 || msg.includes("already") || msg.includes("registered")) {
        const { data: list, error: listErr } = await admin.auth.admin.listUsers();
        if (listErr) return json({ error: listErr.message }, 500);
        const existing = list?.users?.find(
          (u) => u.email?.toLowerCase() === parsed.email.toLowerCase()
        );
        if (!existing) return json({ error: createErr?.message ?? "Création échouée" }, 500);
        finalUserId = existing.id;
      } else {
        return json({ error: createErr?.message ?? "Création échouée" }, 500);
      }
    }

    // 4) Upsert profil (plan + accès)
    const { error: upErr } = await admin.from("profiles").upsert({
      id: finalUserId!,
      email: parsed.email,
      full_name: parsed.fullName ?? null,
      plan: parsed.plan,
      granted_by_admin: parsed.grantedByAdmin ?? true,
    });
    if (upErr) return json({ error: upErr.message }, 500);

    // 5) Invitation best-effort (ne bloque pas si SMTP non configuré)
    if (parsed.sendInvite) {
      try {
        await admin.auth.admin.inviteUserByEmail(parsed.email);
      } catch {
        // noop
      }
    }

    // 6) Réponse clean
    return json({ success: true, user_id: finalUserId });
  } catch (e) {
    if (e instanceof z.ZodError) return json({ error: e.issues }, 400);
    return json({ error: (e as Error).message ?? "Erreur inconnue" }, 500);
  }
});

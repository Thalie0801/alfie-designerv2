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

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const userId = await getAuthUserId(req);
    if (!userId) return json({ error: "Non authentifié" }, 401);

    const clientUser = supabaseUserFromReq(req);
    if (!(await assertIsAdmin(clientUser, userId))) return json({ error: "Interdit" }, 403);

    const body = await req.json();
    const parsed = CreateUserBody.parse(body);

    if (parsed.sendInvite === false && !parsed.password) {
      return json({ error: "Mot de passe requis si sendInvite = false" }, 400);
    }

    const admin = supabaseAdmin();

    const { data: userRes, error: createErr } = await admin.auth.admin.createUser({
      email: parsed.email,
      password: parsed.password ?? crypto.randomUUID(),
      email_confirm: !!parsed.password,
      user_metadata: { full_name: parsed.fullName ?? "" },
    });
    if (createErr || !userRes?.user) return json({ error: createErr?.message ?? "Création échouée" }, 500);

    const { error: upErr } = await admin.from("profiles").upsert({
      id: userRes.user.id,
      email: parsed.email,
      full_name: parsed.fullName ?? null,
      plan: parsed.plan,
      granted_by_admin: parsed.grantedByAdmin ?? true,
    });
    if (upErr) return json({ error: upErr.message }, 500);

    if (parsed.sendInvite) {
      await admin.auth.admin.inviteUserByEmail(parsed.email);
    }

    return json({ success: true, user_id: userRes.user.id });
  } catch (e) {
    if (e instanceof z.ZodError) return json({ error: e.issues }, 400);
    return json({ error: (e as Error).message ?? "Erreur inconnue" }, 500);
  }
});

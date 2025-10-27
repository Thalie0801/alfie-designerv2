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
import { ResetPasswordBody } from "../_shared/validation.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const userId = await getAuthUserId(req);
    if (!userId) return json({ error: "Non authentifié" }, 401);

    const clientUser = supabaseUserFromReq(req);
    if (!(await assertIsAdmin(clientUser, userId))) return json({ error: "Interdit" }, 403);

    const body = await req.json();
    const parsed = ResetPasswordBody.parse(body);

    const admin = supabaseAdmin();

    const { data: list, error: listErr } = await admin.auth.admin.listUsers();
    if (listErr) return json({ error: listErr.message }, 500);

    const target = list?.users?.find((u) => u.email?.toLowerCase() === parsed.email.toLowerCase());
    if (!target) return json({ error: "Utilisateur introuvable" }, 404);

    const { error: upErr } = await admin.auth.admin.updateUserById(target.id, {
      password: parsed.password,
    });
    if (upErr) return json({ error: upErr.message }, 500);

    return json({ success: true, user_id: target.id });
  } catch (e) {
    if (e instanceof z.ZodError) return json({ error: e.issues }, 400);
    return json({ error: (e as Error).message ?? "Erreur inconnue" }, 500);
  }
});

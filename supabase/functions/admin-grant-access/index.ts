import { z } from "zod";
import {
  supabaseAdmin,
  supabaseUserFromReq,
  getAuthUserId,
  assertIsAdmin,
  json,
} from "../_shared/utils/admin.ts";
import { GrantAccessBody } from "../_shared/validation.ts";

import { corsHeaders } from "../_shared/cors.ts";
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const userId = await getAuthUserId(req);
    if (!userId) return json({ error: "Non authentifié" }, 401);

    const clientUser = supabaseUserFromReq(req);
    if (!(await assertIsAdmin(clientUser, userId))) return json({ error: "Interdit" }, 403);

    const body = await req.json();
    const parsed = GrantAccessBody.parse(body);

    const admin = supabaseAdmin();

    const { error: upErr } = await admin
      .from("profiles")
      .update({
        plan: parsed.plan,
        granted_by_admin: parsed.granted_by_admin ?? true,
      })
      .eq("id", parsed.user_id);
    if (upErr) return json({ error: upErr.message }, 500);

    const updates: Record<string, number> = {};
    if (typeof parsed.quota_visuals_per_month === "number") updates["quota_visuals_per_month"] = parsed.quota_visuals_per_month;
    if (typeof parsed.quota_brands === "number") updates["quota_brands"] = parsed.quota_brands;
    if (typeof parsed.quota_videos === "number") updates["quota_videos"] = parsed.quota_videos;
    if (typeof parsed.quota_woofs === "number") updates["quota_woofs"] = parsed.quota_woofs;

    if (Object.keys(updates).length) {
      const { error: uqErr } = await admin.from("profiles").update(updates).eq("id", parsed.user_id);
      if (uqErr) return json({ error: uqErr.message }, 500);
    }

    return json({ success: true });
  } catch (e) {
    if (e instanceof z.ZodError) return json({ error: e.issues }, 400);
    return json({ error: (e as Error).message ?? "Erreur inconnue" }, 500);
  }
});

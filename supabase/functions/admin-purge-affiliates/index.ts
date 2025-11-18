import {
  supabaseAdmin,
  supabaseUserFromReq,
  getAuthUserId,
  assertIsAdmin,
  json,
} from "../_shared/utils/admin.ts";

import { corsHeaders } from "../_shared/cors.ts";
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const userId = await getAuthUserId(req);
    if (!userId) return json({ error: "Non authentifié" }, 401);

    const clientUser = supabaseUserFromReq(req);
    if (!(await assertIsAdmin(clientUser, userId))) {
      return json({ error: "Interdit" }, 403);
    }

    const admin = supabaseAdmin();

    // Soft delete: marquer comme purgé au lieu de supprimer
    const { data, error } = await admin
      .from("affiliates")
      .update({ status: "purged" })
      .neq("status", "purged")
      .select();

    if (error) return json({ error: error.message }, 500);

    return json({ 
      success: true, 
      count: data?.length || 0,
      message: `${data?.length || 0} affilié(s) purgé(s)` 
    });
  } catch (e) {
    return json({ error: (e as Error).message ?? "Erreur inconnue" }, 500);
  }
});

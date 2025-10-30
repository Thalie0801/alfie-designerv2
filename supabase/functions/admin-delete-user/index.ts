import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  supabaseAdmin,
  supabaseUserFromReq,
  getAuthUserId,
  assertIsAdmin,
  corsHeaders,
  json,
} from "../_shared/utils/admin.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const userId = await getAuthUserId(req);
    if (!userId) return json({ error: "Non authentifié" }, 401);

    const clientUser = supabaseUserFromReq(req);
    if (!(await assertIsAdmin(clientUser, userId))) {
      return json({ error: "Interdit - droits admin requis" }, 403);
    }

    const { targetUserId } = await req.json();
    
    if (!targetUserId) {
      return json({ error: "targetUserId requis" }, 400);
    }

    const admin = supabaseAdmin();

    console.log(`[admin-delete-user] Suppression de l'utilisateur: ${targetUserId}`);

    // 1. Supprimer l'entrée affiliates (si elle existe)
    const { error: affiliateError } = await admin
      .from("affiliates")
      .delete()
      .eq("id", targetUserId);

    if (affiliateError) {
      console.error("[admin-delete-user] Erreur suppression affiliates:", affiliateError);
    }

    // 2. Supprimer le profil
    const { error: profileError } = await admin
      .from("profiles")
      .delete()
      .eq("id", targetUserId);

    if (profileError) {
      console.error("[admin-delete-user] Erreur suppression profil:", profileError);
      return json({ error: `Erreur suppression profil: ${profileError.message}` }, 500);
    }

    // 3. Supprimer le compte auth
    const { error: authError } = await admin.auth.admin.deleteUser(targetUserId);

    if (authError) {
      console.error("[admin-delete-user] Erreur suppression compte auth:", authError);
      return json({ error: `Erreur suppression compte: ${authError.message}` }, 500);
    }

    console.log(`[admin-delete-user] Utilisateur ${targetUserId} supprimé avec succès`);

    return json({ 
      success: true, 
      message: "Utilisateur supprimé complètement (profil, affilié, compte)"
    });

  } catch (e) {
    console.error("[admin-delete-user] Erreur:", e);
    return json({ error: (e as Error).message ?? "Erreur inconnue" }, 500);
  }
});

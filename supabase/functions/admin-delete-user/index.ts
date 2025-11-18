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
      return json({ error: "Interdit - droits admin requis" }, 403);
    }

    const { targetUserId } = await req.json();
    
    if (!targetUserId) {
      return json({ error: "targetUserId requis" }, 400);
    }

    const admin = supabaseAdmin();

    console.log(`[admin-delete-user] Suppression de l'utilisateur: ${targetUserId}`);

    let authUserExists = false;
    let deletedItems = [];

    // 1. Vérifier si l'utilisateur auth existe
    const { data: userData, error: getUserError } = await admin.auth.admin.getUserById(targetUserId);
    
    if (!getUserError && userData?.user) {
      authUserExists = true;
      console.log(`[admin-delete-user] Utilisateur auth trouvé: ${userData.user.email}`);
    } else {
      console.log(`[admin-delete-user] Utilisateur auth non trouvé (probablement déjà supprimé)`);
    }

    // 2. Supprimer l'entrée affiliates (si elle existe)
    const { error: affiliateError } = await admin
      .from("affiliates")
      .delete()
      .eq("id", targetUserId);

    if (affiliateError) {
      console.error("[admin-delete-user] Erreur suppression affiliates:", affiliateError);
    } else {
      deletedItems.push("affiliate");
    }

    // 3. Supprimer le profil
    const { error: profileError } = await admin
      .from("profiles")
      .delete()
      .eq("id", targetUserId);

    if (profileError) {
      console.error("[admin-delete-user] Erreur suppression profil:", profileError);
      return json({ error: `Erreur suppression profil: ${profileError.message}` }, 500);
    }
    deletedItems.push("profile");

    // 4. Supprimer le compte auth seulement s'il existe
    if (authUserExists) {
      const { error: authError } = await admin.auth.admin.deleteUser(targetUserId);

      if (authError) {
        console.error("[admin-delete-user] Erreur suppression compte auth:", authError);
        return json({ error: `Erreur suppression compte: ${authError.message}` }, 500);
      }
      deletedItems.push("auth");
    }

    console.log(`[admin-delete-user] Éléments supprimés: ${deletedItems.join(", ")}`);

    return json({ 
      success: true, 
      message: `Utilisateur supprimé (${deletedItems.join(", ")})`
    });

  } catch (e) {
    console.error("[admin-delete-user] Erreur:", e);
    return json({ error: (e as Error).message ?? "Erreur inconnue" }, 500);
  }
});

import { supabaseAdmin, getAuthUserId, assertIsAdmin, json } from "../_shared/utils/admin.ts";

import { corsHeaders } from "../_shared/cors.ts";
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const userId = await getAuthUserId(req);
    if (!userId) {
      return json({ error: "Unauthorized" }, 401);
    }

    const admin = supabaseAdmin();
    const isAdmin = await assertIsAdmin(admin, userId);
    if (!isAdmin) {
      return json({ error: "Admin access required" }, 403);
    }

    const { affiliate_email, parent_email } = await req.json();

    if (!affiliate_email || !parent_email) {
      return json({ error: "affiliate_email and parent_email required" }, 400);
    }

    // Get parent affiliate ID
    const { data: parent, error: parentError } = await admin
      .from("affiliates")
      .select("id")
      .eq("email", parent_email.toLowerCase())
      .maybeSingle();

    if (parentError || !parent) {
      return json({ error: `Parent affiliate not found: ${parent_email}` }, 404);
    }

    // Get affiliate to link
    const { data: affiliate, error: affiliateError } = await admin
      .from("affiliates")
      .select("id, parent_id")
      .eq("email", affiliate_email.toLowerCase())
      .maybeSingle();

    if (affiliateError || !affiliate) {
      return json({ error: `Affiliate not found: ${affiliate_email}` }, 404);
    }

    // Prevent self-parenting
    if (affiliate.id === parent.id) {
      return json({ error: "Cannot set affiliate as their own parent" }, 400);
    }

    // Update parent_id
    const { error: updateError } = await admin
      .from("affiliates")
      .update({ parent_id: parent.id })
      .eq("id", affiliate.id);

    if (updateError) {
      console.error("[admin-link-affiliate] Update error:", updateError);
      return json({ error: updateError.message }, 500);
    }

    // Recalculate parent status
    const { error: rpcError } = await admin.rpc("update_affiliate_status", {
      affiliate_id_param: parent.id
    });

    if (rpcError) {
      console.error("[admin-link-affiliate] RPC error:", rpcError);
    }

    // Also recalculate old parent status if existed
    if (affiliate.parent_id) {
      await admin.rpc("update_affiliate_status", {
        affiliate_id_param: affiliate.parent_id
      });
    }

    return json({
      success: true,
      message: `${affiliate_email} linked to ${parent_email}`,
      affiliate_id: affiliate.id,
      parent_id: parent.id
    });

  } catch (error: any) {
    console.error("[admin-link-affiliate] Error:", error);
    return json({ error: error.message || "Unknown error" }, 500);
  }
});

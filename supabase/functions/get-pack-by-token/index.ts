import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const token = url.searchParams.get("token");

    if (!token || token.length < 10) {
      return new Response(
        JSON.stringify({ success: false, error: "Token invalide" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log("[get-pack-by-token] Looking up token:", token.substring(0, 8) + "...");

    const { data: lead, error } = await supabase
      .from("leads")
      .select("id, email, generated_assets, intent")
      .eq("recovery_token", token)
      .maybeSingle();

    if (error) {
      console.error("[get-pack-by-token] Database error:", error);
      return new Response(
        JSON.stringify({ success: false, error: "Erreur serveur" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!lead) {
      console.log("[get-pack-by-token] No lead found for token");
      return new Response(
        JSON.stringify({ success: false, error: "Pack non trouvé ou lien expiré" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const assets = lead.generated_assets || [];
    const brandName = lead.intent?.brandName || "Ton pack";

    console.log("[get-pack-by-token] Found pack with", Array.isArray(assets) ? assets.length : 0, "assets");

    return new Response(
      JSON.stringify({
        success: true,
        brandName,
        assets,
        email: lead.email,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("[get-pack-by-token] Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: "Erreur serveur" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

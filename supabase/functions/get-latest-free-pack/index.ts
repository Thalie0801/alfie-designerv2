import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "zod";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const RequestSchema = z.object({
  email: z.string().email().trim().toLowerCase(),
});

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const rawBody = await req.json();
    const parseResult = RequestSchema.safeParse(rawBody);

    if (!parseResult.success) {
      return new Response(
        JSON.stringify({ error: "Invalid email" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { email } = parseResult.data;

    console.log("[get-latest-free-pack] Looking for assets for:", email);

    // Get lead with generated_assets directly
    const { data: lead, error: leadError } = await supabase
      .from("leads")
      .select("id, generated_assets")
      .eq("email", email)
      .maybeSingle();

    if (leadError) {
      console.error("[get-latest-free-pack] Lead query error:", leadError);
      return new Response(
        JSON.stringify({ success: false, assets: [], error: "Failed to fetch lead" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!lead) {
      console.log("[get-latest-free-pack] Lead not found for:", email);
      return new Response(
        JSON.stringify({ success: false, assets: [], message: "No pack found for this email" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Return assets from lead.generated_assets
    const assets = lead.generated_assets || [];
    
    console.log("[get-latest-free-pack] Found assets:", Array.isArray(assets) ? assets.length : 0);

    return new Response(
      JSON.stringify({
        success: true,
        assets: assets,
        leadId: lead.id,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("[get-latest-free-pack] Error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

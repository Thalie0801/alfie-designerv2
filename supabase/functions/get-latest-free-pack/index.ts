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

    // Find lead by email
    const { data: lead, error: leadError } = await supabase
      .from("leads")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    if (leadError || !lead) {
      console.log("[get-latest-free-pack] Lead not found for:", email);
      return new Response(
        JSON.stringify({ success: false, assets: [], message: "No pack found for this email" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get the most recent free-pack assets from library_assets
    // They're stored with user_id matching the lead pattern or with metadata.source = "free-pack"
    const { data: assets, error: assetsError } = await supabase
      .from("library_assets")
      .select("id, cloudinary_url, type, format, metadata, created_at")
      .or(`metadata->>source.eq.free-pack,metadata->>lead_id.eq.${lead.id}`)
      .order("created_at", { ascending: false })
      .limit(3);

    if (assetsError) {
      console.error("[get-latest-free-pack] Assets query error:", assetsError);
      return new Response(
        JSON.stringify({ success: false, assets: [], error: "Failed to fetch assets" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[get-latest-free-pack] Found assets:", assets?.length || 0);

    const formattedAssets = (assets || []).map((a, i) => ({
      title: a.format || `Asset ${i + 1}`,
      url: a.cloudinary_url,
      thumbnailUrl: a.cloudinary_url,
      ratio: a.format === "story" ? "9:16" : a.format === "cover" ? "4:5" : "1:1",
    }));

    return new Response(
      JSON.stringify({
        success: true,
        assets: formattedAssets,
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

import { corsHeaders } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

interface CampaignPlanAsset {
  type: "image" | "carousel" | "video";
  count: number;
  topic: string;
  slides?: number;
}

interface CampaignPlanRequest {
  campaign_name: string;
  assets: CampaignPlanAsset[];
  brandKit?: {
    primary_color?: string;
    secondary_color?: string;
    font_family?: string;
    logo_url?: string;
    tone?: string;
  };
}

Deno.serve(async (req) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ ok: false, error: "method_not_allowed" }),
      {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  try {
    // Parse request body
    const body: CampaignPlanRequest = await req.json();
    const { campaign_name, assets, brandKit } = body;

    if (!campaign_name || !assets || !Array.isArray(assets) || assets.length === 0) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: "missing_required_fields",
          message: "campaign_name and assets array are required",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Get authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ ok: false, error: "missing_authorization" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Create Supabase client with user's auth
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: {
        headers: { Authorization: authHeader },
      },
    });

    // Get authenticated user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      console.error("[chat-create-campaign] User auth error:", userError);
      return new Response(
        JSON.stringify({ ok: false, error: "unauthorized" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log("[chat-create-campaign] Creating campaign for user:", user.id);

    // Create campaign
    const { data: campaign, error: campaignError } = await supabase
      .from("campaigns")
      .insert({
        user_id: user.id,
        name: campaign_name,
        status: "running",
      })
      .select()
      .single();

    if (campaignError) {
      console.error("[chat-create-campaign] Campaign creation error:", campaignError);
      return new Response(
        JSON.stringify({
          ok: false,
          error: "campaign_creation_failed",
          message: campaignError.message,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log("[chat-create-campaign] Campaign created:", campaign.id);

    // Prepare assets to insert
    const assetsToInsert = [];
    
    for (const assetSpec of assets) {
      const { type, count, topic, slides } = assetSpec;
      
      // Create multiple assets if count > 1
      for (let i = 0; i < count; i++) {
        assetsToInsert.push({
          campaign_id: campaign.id,
          type,
          status: "pending",
          config: {
            topic,
            prompt: topic,
            slides: type === "carousel" ? (slides || 5) : undefined,
            brandKit,
            index: i + 1,
            total: count,
          },
        });
      }
    }

    // Insert all assets
    const { data: createdAssets, error: assetsError } = await supabase
      .from("assets")
      .insert(assetsToInsert)
      .select();

    if (assetsError) {
      console.error("[chat-create-campaign] Assets creation error:", assetsError);
      // Try to clean up the campaign
      await supabase.from("campaigns").delete().eq("id", campaign.id);
      
      return new Response(
        JSON.stringify({
          ok: false,
          error: "assets_creation_failed",
          message: assetsError.message,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log("[chat-create-campaign] Assets created:", createdAssets.length);

    // Return success response
    return new Response(
      JSON.stringify({
        ok: true,
        campaign,
        assets: createdAssets,
        summary: {
          campaign_id: campaign.id,
          campaign_name: campaign.name,
          total_assets: createdAssets.length,
          images: createdAssets.filter((a) => a.type === "image").length,
          carousels: createdAssets.filter((a) => a.type === "carousel").length,
          videos: createdAssets.filter((a) => a.type === "video").length,
        },
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("[chat-create-campaign] Unexpected error:", error);
    return new Response(
      JSON.stringify({
        ok: false,
        error: "internal_error",
        message: error instanceof Error ? error.message : String(error),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

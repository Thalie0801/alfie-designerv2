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

    console.log("[resend-delivery-email] Resending for:", email);

    // Rate limit: max 3 resends per email per hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count: recentCount } = await supabase
      .from("email_queue")
      .select("*", { count: "exact", head: true })
      .eq("to_email", email)
      .eq("template", "delivery_ready")
      .gte("created_at", oneHourAgo);

    if ((recentCount || 0) >= 3) {
      console.log("[resend-delivery-email] Rate limit exceeded for:", email);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Trop de demandes. Réessaie dans 1 heure.",
          code: "RATE_LIMIT" 
        }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Find lead with generated_assets
    const { data: lead } = await supabase
      .from("leads")
      .select("id, intent, generated_assets")
      .eq("email", email)
      .maybeSingle();

    if (!lead) {
      return new Response(
        JSON.stringify({ success: false, error: "Aucun pack trouvé pour cet email" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get asset URLs from lead.generated_assets
    const assets = lead.generated_assets || [];
    const assetUrls = Array.isArray(assets) 
      ? assets.filter((a: any) => a?.url && !a.url.startsWith('/')).map((a: any) => a.url)
      : [];

    // Queue delivery email
    const { error: queueError } = await supabase.from("email_queue").insert({
      to_email: email,
      template: "delivery_ready",
      payload: {
        lead_id: lead.id,
        preview_urls: assetUrls,
        resend: true,
      },
      status: "queued",
      run_after: new Date().toISOString(),
    });

    if (queueError) {
      console.error("[resend-delivery-email] Queue error:", queueError);
      return new Response(
        JSON.stringify({ success: false, error: "Erreur lors de l'envoi" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[resend-delivery-email] Email queued for:", email);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Email en cours d'envoi. Vérifie ta boîte mail (et les spams).",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("[resend-delivery-email] Error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

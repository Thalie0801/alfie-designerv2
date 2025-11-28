import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

import { corsHeaders } from "../_shared/cors.ts";
import { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } from "../_shared/env.ts";
const parseBody = async (req: Request): Promise<Record<string, string>> => {
  const contentType = req.headers.get("content-type") || "";
  try {
    if (contentType.includes("application/json")) {
      return await req.json();
    }
    const text = await req.text();
    const params = new URLSearchParams(text);
    const result: Record<string, string> = {};
    params.forEach((v, k) => (result[k] = v));
    return result;
  } catch (_) {
    return {};
  }
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await parseBody(req);
    const ref = body.ref || body.affiliate_id;
    const utm_source = body.utm_source || null;
    const utm_medium = body.utm_medium || null;
    const utm_campaign = body.utm_campaign || null;

    if (!ref) {
      return new Response(JSON.stringify({ error: "Missing ref" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    // Use service role to bypass RLS for server-side write
    const supabaseAdmin = createClient(
      SUPABASE_URL!,
      SUPABASE_SERVICE_ROLE_KEY!
    );

    // Lookup affiliate by slug or UUID
    let affiliateId: string;
    
    // Check if ref is a UUID or a slug
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(ref);
    
    if (isUUID) {
      affiliateId = ref;
    } else {
      // Lookup by slug
      const { data: affiliate, error: lookupError } = await supabaseAdmin
        .from("affiliates")
        .select("id")
        .eq("slug", ref)
        .maybeSingle();
      
      if (lookupError || !affiliate) {
        console.error("Affiliate not found for slug:", ref, lookupError);
        return new Response(JSON.stringify({ error: "Affiliate not found" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 404,
        });
      }
      
      affiliateId = affiliate.id;
    }

    const click_id = crypto.randomUUID();

    const { error } = await supabaseAdmin
      .from("affiliate_clicks")
      .insert({
        affiliate_id: affiliateId,
        click_id,
        utm_source,
        utm_medium,
        utm_campaign,
      });

    if (error) {
      console.error("track-affiliate-click insert error:", error);
      return new Response(JSON.stringify({ error: error.message }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      });
    }

    return new Response(JSON.stringify({ ok: true, click_id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (e: any) {
    console.error("track-affiliate-click failure:", e);
    return new Response(JSON.stringify({ error: e?.message || "Unknown error" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
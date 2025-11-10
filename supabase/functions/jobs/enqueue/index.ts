import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type JobKind = "image" | "video" | "carousel";

function toJobType(kind: JobKind): string {
  switch (kind) {
    case "video":
      return "generate_video";
    case "carousel":
      return "render_carousels";
    default:
      return "render_images";
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");

  if (!supabaseUrl || !supabaseAnonKey) {
    return new Response(JSON.stringify({ error: "misconfigured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const payload = await req.json();
    const brandId = typeof payload?.brandId === "string" ? payload.brandId : null;
    const kind = typeof payload?.kind === "string" ? (payload.kind as JobKind) : null;
    const rawJobPayload = payload?.payload;
    const providedOrderId = typeof payload?.orderId === "string" ? payload.orderId : null;

    if (!brandId) {
      return new Response(JSON.stringify({ error: "missing_brand" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!kind || !["image", "video", "carousel"].includes(kind)) {
      return new Response(JSON.stringify({ error: "invalid_kind" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!isPlainObject(rawJobPayload)) {
      return new Response(JSON.stringify({ error: "invalid_payload" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    });

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let orderId = providedOrderId;

    if (!orderId) {
      const campaignName =
        typeof rawJobPayload.campaign_name === "string" && rawJobPayload.campaign_name.trim().length > 0
          ? rawJobPayload.campaign_name.trim()
          : `Chat_${kind}_${Date.now()}`;

      const orderBrief = isPlainObject(rawJobPayload.brief_json)
        ? rawJobPayload.brief_json
        : rawJobPayload;

      const { data: orderRecord, error: orderError } = await supabase
        .from("orders")
        .insert({
          user_id: user.id,
          brand_id: brandId,
          campaign_name: campaignName,
          brief_json: orderBrief,
          metadata: { source: "jobs/enqueue", kind },
        })
        .select("id")
        .single();

      if (orderError || !orderRecord) {
        const message = orderError?.message ?? "order_insert_failed";
        return new Response(JSON.stringify({ error: message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      orderId = orderRecord.id;
    } else {
      const { data: existingOrder, error: lookupError } = await supabase
        .from("orders")
        .select("id")
        .eq("id", orderId)
        .eq("user_id", user.id)
        .single();

      if (lookupError || !existingOrder) {
        return new Response(JSON.stringify({ error: "order_not_found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const jobPayload = { ...rawJobPayload, order_id: orderId, brand_id: brandId } as Record<string, unknown>;
    const jobType = toJobType(kind);

    const { data: jobRecord, error: jobError } = await supabase
      .from("job_queue")
      .insert({
        user_id: user.id,
        order_id: orderId,
        type: jobType,
        status: "queued",
        payload: jobPayload,
      })
      .select("id")
      .single();

    if (jobError || !jobRecord) {
      const message = jobError?.message ?? "job_enqueue_failed";
      return new Response(JSON.stringify({ error: message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({ orderId, jobId: jobRecord.id, jobType }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("[jobs/enqueue]", error);
    const message = error instanceof Error ? error.message : "unknown_error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

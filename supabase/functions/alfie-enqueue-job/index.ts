import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY } from "../_shared/env.ts";

const IntentSchema = z.object({
  brandId: z.string().min(1),
  kind: z.enum(["image", "carousel", "video", "text"]),
  language: z.enum(["fr", "en", "es"]).default("fr"),
  goal: z.enum(["awareness", "lead", "sale"]).default("awareness"),
  ratio: z.enum(["1:1", "4:5", "9:16", "16:9", "3:4"]).default("1:1"),
  slides: z.number().int().positive().max(20).nullable().default(null),
  templateId: z.string().optional().nullable(),
  copyBrief: z.string().min(3),
  cta: z.string().optional().nullable(),
  campaign: z.string().optional().nullable(),
  paletteLock: z.boolean().default(true),
  typographyLock: z.boolean().default(false),
  assetsRefs: z.array(z.string()).default([]),
  quality: z.enum(["fast", "high"]).default("fast"),
  tone_pack: z.enum(["brand_default", "apple_like", "playful", "b2b_crisp"]).default("brand_default"),
});

const RequestSchema = z.object({
  intent: IntentSchema,
});

type Intent = z.infer<typeof IntentSchema>;

type PlanLimitRow = {
  max_visuals: number | null;
  used: number | null;
};

function jobTypeFromKind(kind: Intent["kind"]): string {
  switch (kind) {
    case "video":
      return "generate_video";
    case "carousel":
      return "render_carousels";
    case "text":
      return "generate_copy";
    default:
      return "render_images";
  }
}

function computeIncrement(intent: Intent): number {
  if (intent.kind === "carousel") {
    return intent.slides ?? 5;
  }
  return 1;
}

function quotaExceeded(limit: PlanLimitRow | null, increment: number): boolean {
  if (!limit) return false;
  const max = typeof limit.max_visuals === "number" ? limit.max_visuals : -1;
  const used = typeof limit.used === "number" ? limit.used : 0;
  if (max < 0) {
    return false;
  }
  return used + increment > max;
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

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
    return new Response(JSON.stringify({ error: "missing_configuration" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser();

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const rawBody = await req.json();
    const { intent } = RequestSchema.parse(rawBody);

    const increment = computeIncrement(intent);
    const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: limit, error: limitError } = await serviceClient
      .from("plan_limits")
      .select("max_visuals, used")
      .eq("brand_id", intent.brandId)
      .maybeSingle();

    if (limitError) {
      console.error("[alfie-enqueue-job] plan_limits lookup failed", limitError);
      return new Response(JSON.stringify({ error: "quota_lookup_failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (quotaExceeded(limit, increment)) {
      return new Response(JSON.stringify({ error: "plan_limit_reached" }), {
        status: 402,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (limit) {
      const { error: updateError } = await serviceClient
        .from("plan_limits")
        .update({
          used: (limit.used ?? 0) + increment,
          updated_at: new Date().toISOString(),
        })
        .eq("brand_id", intent.brandId);

      if (updateError) {
        console.error("[alfie-enqueue-job] plan_limits update failed", updateError);
        return new Response(JSON.stringify({ error: "quota_update_failed" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else {
      const { error: insertError } = await serviceClient
        .from("plan_limits")
        .insert({ brand_id: intent.brandId, used: increment })
        .single();

      if (insertError) {
        console.error("[alfie-enqueue-job] plan_limits insert failed", insertError);
        return new Response(JSON.stringify({ error: "quota_insert_failed" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const { data: orderRecord, error: orderError } = await userClient
      .from("orders")
      .insert({
        user_id: user.id,
        brand_id: intent.brandId,
        status: "queued",
        meta: { source: "alfie-enqueue-job", kind: intent.kind },
        intent_json: intent,
        summary: intent.copyBrief.slice(0, 240),
        source: "alfie-doer",
      })
      .select("id")
      .single();

    if (orderError || !orderRecord) {
      console.error("[alfie-enqueue-job] order insert failed", orderError);
      return new Response(JSON.stringify({ error: "order_insert_failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const jobType = jobTypeFromKind(intent.kind);
    const payload = {
      intent,
      brand_id: intent.brandId,
      order_id: orderRecord.id,
      tone_pack: intent.tone_pack,
    };

    const { data: jobRecord, error: jobError } = await userClient
      .from("job_queue")
      .insert({
        user_id: user.id,
        order_id: orderRecord.id,
        type: jobType,
        status: "queued",
        payload,
      })
      .select("id")
      .single();

    if (jobError || !jobRecord) {
      console.error("[alfie-enqueue-job] job insert failed", jobError);
      return new Response(JSON.stringify({ error: "job_enqueue_failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({ orderId: orderRecord.id, jobId: jobRecord.id, jobType }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("[alfie-enqueue-job] unexpected error", err);
    const message = err instanceof z.ZodError ? err.issues.map((issue) => issue.message).join(" | ") : "unexpected_error";
    return new Response(JSON.stringify({ error: message }), {
      status: err instanceof z.ZodError ? 400 : 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

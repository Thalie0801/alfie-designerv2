// supabase/functions/alfie-plan/index.ts
// Planifie un order: construit AlfieIntent + crée le pipeline de jobs, RLS-safe.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";

/* --------------------------------- ZOD ---------------------------------- */

const RatioEnum = z.enum(["1:1", "9:16", "16:9", "3:4"]);
const KindEnum = z.enum(["carousel", "image", "video", "text"]);
const LangEnum = z.enum(["fr", "en", "es"]);
const GoalEnum = z.enum(["awareness", "lead", "sale"]);
const QualEnum = z.enum(["fast", "high"]);

const IntentSchema = z.object({
  kind: KindEnum,
  brandId: z.string().uuid(),
  campaign: z.string().optional(),
  language: LangEnum.default("fr"),
  audience: z.string().optional(),
  goal: GoalEnum.optional(),
  slides: z.number().int().min(1).optional(),
  ratio: RatioEnum.optional(),
  templateId: z.string().optional(),
  copyBrief: z.string().optional(),
  cta: z.string().optional(),
  paletteLock: z.boolean().default(false),
  typographyLock: z.boolean().default(false),
  assetsRefs: z.array(z.string()).optional(),
  quality: QualEnum.default("fast"),
});
type AlfieIntent = z.infer<typeof IntentSchema>;

interface JobPlan {
  kind: "copy" | "vision" | "render" | "upload" | "thumb" | "publish";
  payload: Record<string, unknown>;
}

/* --------------------------------- CORS --------------------------------- */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ ok: false, error: "Method Not Allowed" }, 405);
  }

  try {
    const supabaseUrl = env("SUPABASE_URL");
    const anonKey = env("SUPABASE_ANON_KEY");
    const serviceKey = env("SUPABASE_SERVICE_ROLE_KEY"); // requis pour jobs/assets/quotas

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing Authorization header");

    // Client user-scoped (respecte RLS avec le JWT du user)
    const sbUser = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Client service (bypass RLS pour écritures système)
    const sbSvc = createClient(supabaseUrl, serviceKey);

    // Auth courante
    const {
      data: { user },
      error: userError,
    } = await sbUser.auth.getUser();
    if (userError || !user) throw new Error("Unauthorized");

    // Parse body
    const body = await req.json().catch(() => ({}));
    const rawIntent = IntentSchema.parse(body.intent);

    // Defaults + règles métier
    const finalIntent = applyDefaults(rawIntent);
    const warnings = validateBusinessRules(finalIntent);

    // Mémoire (global + user + brand)
    const memory = await readMemory(sbUser, user.id, finalIntent.brandId);
    enrichIntentWithMemory(finalIntent, memory);

    // 1) Créer l'order (user-scoped)
    const { data: order, error: orderError } = await sbUser
      .from("orders")
      .insert({
        user_id: user.id,
        brand_id: finalIntent.brandId,
        intent_json: finalIntent,
        status: "draft",
      })
      .select()
      .single();
    if (orderError) throw orderError;

    // 2) Construire le plan
    const plan = buildPipeline(finalIntent, order.id);

    // 3) Insérer les jobs (service role)
    const { error: jobsError } = await sbSvc.from("jobs").insert(
      plan.map((j) => ({
        order_id: order.id,
        kind: j.kind,
        payload: j.payload,
        status: "queued",
        attempt: 0,
      })),
    );
    if (jobsError) {
      // rollback best-effort
      await sbSvc.from("orders").delete().eq("id", order.id);
      throw jobsError;
    }

    // 4) Passer la commande en queued (user-scoped OK via WITH CHECK)
    const { error: updErr } = await sbUser
      .from("orders")
      .update({ status: "queued" })
      .eq("id", order.id);
    if (updErr) throw updErr;

    return json(
      {
        ok: true,
        data: {
          orderId: order.id,
          plan: plan.map((j) => j.kind),
          warnings,
        },
      },
      200,
    );
  } catch (error) {
    console.error("alfie-plan error:", error);
    return json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      400,
    );
  }
});

/* ------------------------------ Helpers --------------------------------- */

function env(k: string): string {
  const v = Deno.env.get(k);
  if (!v) throw new Error(`Missing env: ${k}`);
  return v;
}

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

/** Defaults intelligents et cohérents avec l’UX */
function applyDefaults(intent: AlfieIntent): AlfieIntent {
  const i = { ...intent };
  if (i.kind === "carousel") {
    i.slides = i.slides ?? 5;
    i.ratio = i.ratio ?? "9:16";
  } else if (i.kind === "image") {
    i.slides = 1;
    i.ratio = i.ratio ?? "1:1";
  } else if (i.kind === "video") {
    i.ratio = i.ratio ?? "16:9";
  }
  return i;
}

/** Règles métier (on remonte en warnings, on ne bloque pas) */
function validateBusinessRules(intent: AlfieIntent): string[] {
  const warnings: string[] = [];
  if (intent.kind === "carousel") {
    if (!intent.slides || intent.slides < 3) {
      warnings.push("Un carrousel doit avoir au moins 3 slides — défaut appliqué si absent.");
    }
    if (!intent.ratio) warnings.push("Un ratio est requis pour les carrousels — défaut appliqué.");
  }
  if (intent.kind === "video" && !intent.ratio) {
    warnings.push("Un ratio est requis pour les vidéos — défaut appliqué.");
  }
  return warnings;
}

/** Lecture mémoire (3 scopes) respectant RLS */
async function readMemory(
  sbUser: ReturnType<typeof createClient>,
  userId: string,
  brandId: string,
): Promise<Array<{ key: string; value: unknown }>> {
  // global (active pour tout user authentifié via policy)
  const g = await sbUser.from("alfie_memory").select("key,value").eq("scope", "global");

  // user
  const u = await sbUser
    .from("alfie_memory")
    .select("key,value")
    .eq("scope", "user")
    .eq("user_id", userId);

  // brand (assoc. user)
  const b = await sbUser
    .from("alfie_memory")
    .select("key,value")
    .eq("scope", "brand")
    .eq("user_id", userId)
    .eq("brand_id", brandId);

  const arr: Array<{ key: string; value: unknown }> = [];
  if (g.data) arr.push(...g.data);
  if (u.data) arr.push(...u.data);
  if (b.data) arr.push(...b.data);
  return arr;
}

/** Enrichissement souple par mémoire (ex: cta.defaults, tone.profile, etc.) */
function enrichIntentWithMemory(
  intent: AlfieIntent,
  memories: Array<{ key: string; value: unknown }>,
) {
  const map = new Map(memories.map((m) => [m.key, m.value]));

  // CTA par défaut
  if (!intent.cta) {
    const cta = map.get("cta.defaults") as { default?: string } | undefined;
    if (cta?.default) intent.cta = cta.default;
  }

  // Verrou palette/typo (ex. brand locks)
  const locks = map.get("brand.locks") as { palette?: boolean; typography?: boolean } | undefined;
  if (locks?.palette) intent.paletteLock = true;
  if (locks?.typography) intent.typographyLock = true;

  // Ratio préféré par canal (ex: reels -> 9:16)
  if (!intent.ratio) {
    const rr = map.get("ratio.defaults") as Record<string, string> | undefined;
    const kindPref = rr?.[intent.kind];
    if (kindPref && isRatio(kindPref)) intent.ratio = kindPref as AlfieIntent["ratio"];
  }
}

function isRatio(x: string): x is AlfieIntent["ratio"] {
  return ["1:1", "9:16", "16:9", "3:4"].includes(x);
}

/** Pipeline de jobs (copy -> vision -> render -> upload -> thumb? -> publish?) */
function buildPipeline(intent: AlfieIntent, orderId: string): JobPlan[] {
  const pipeline: JobPlan[] = [];

  // 1) COPY — on génère tjs un cadrage si visuel (ou si brief fourni)
  if (intent.kind !== "text" || intent.copyBrief) {
    pipeline.push({
      kind: "copy",
      payload: {
        order_id: orderId,
        brief: intent.copyBrief ?? null,
        language: intent.language,
        cta: intent.cta ?? null,
        kind: intent.kind,
        slides: intent.slides ?? null,
      },
    });
  }

  // 2) VISION — pour tout ce qui n'est pas text
  if (["image", "carousel", "video"].includes(intent.kind)) {
    pipeline.push({
      kind: "vision",
      payload: {
        order_id: orderId,
        kind: intent.kind,
        ratio: intent.ratio,
        slides: intent.slides ?? (intent.kind === "image" ? 1 : null),
        locks: {
          palette: intent.paletteLock,
          typography: intent.typographyLock,
        },
        template_id: intent.templateId ?? null,
        assets_refs: intent.assetsRefs ?? [],
      },
    });
  }

  // 3) RENDER
  pipeline.push({
    kind: "render",
    payload: {
      order_id: orderId,
      kind: intent.kind,
      ratio: intent.ratio,
      quality: intent.quality,
    },
  });

  // 4) UPLOAD Cloudinary (tags obligatoires)
  pipeline.push({
    kind: "upload",
    payload: {
      order_id: orderId,
      brand_id: intent.brandId,
      tags: buildTags(intent, orderId),
    },
  });

  // 5) THUMB si carrousel/vidéo
  if (["carousel", "video"].includes(intent.kind)) {
    pipeline.push({
      kind: "thumb",
      payload: { order_id: orderId },
    });
  }

  // 6) PUBLISH (optionnel)
  // pipeline.push({ kind: "publish", payload: { order_id: orderId } });

  return pipeline;
}

/** Tags Cloudinary minimaux (anti-oubli) */
function buildTags(intent: AlfieIntent, orderId: string): string[] {
  return [
    `brand:${intent.brandId}`,
    `order:${orderId}`,
    `type:${intent.kind}`,
    `ratio:${intent.ratio ?? "1:1"}`,
    `lang:${intent.language}`,
    `campaign:${slugify(intent.campaign ?? "default")}`,
  ];
}

function slugify(str: string): string {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

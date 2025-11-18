// functions/alfie-generate/index.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { userHasAccess } from "../_shared/accessControl.ts";

import { corsHeaders } from "../_shared/cors.ts";
type GenType = "hero" | "carousel" | "insight" | "reel";

interface GenerateRequest {
  type: GenType;
  theme: string;
  style?: string;
  brandVoice?: string;
  channel?: string;
}

type CopyPayload = {
  headline?: string; // HERO
  hook?: string; // CAROUSEL/REEL
  steps?: string[]; // CAROUSEL/REEL
  cta?: string;
  caption?: string;
  hashtags?: string[];
};

const DEFAULTS = {
  style: "moderne",
  brandVoice: "professionnel",
  channel: "LinkedIn",
} as const;

const TYPE_LIMITS = {
  hero: {
    headlineMaxWords: 12,
    subtextMaxWords: 20, // on le reflète indirectement via caption
  },
  carousel: {
    hookMaxWords: 12,
    stepMaxChars: 45,
    stepsMin: 3,
    stepsMax: 5,
  },
  insight: {
    contextMaxWords: 15, // via caption
  },
  reel: {
    hookMaxWords: 8,
    stepsMin: 3,
    stepsMax: 5,
  },
} as const;

/** Utilitaires */
const isString = (v: unknown): v is string => typeof v === "string";
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const wordCount = (s: string) => (s || "").trim().split(/\s+/).filter(Boolean).length;

function sanitizeHashtags(list: unknown): string[] {
  const raw = Array.isArray(list) ? list : [];
  const out: string[] = [];
  for (const h of raw) {
    if (!isString(h)) continue;
    let tag = h.trim();
    if (!tag) continue;
    if (!tag.startsWith("#")) tag = `#${tag}`;
    // supprime espaces internes multiples, caractères exotiques de fin
    tag = tag.replace(/\s+/g, "").replace(/[.,;:!?)]*$/g, "");
    if (tag.length > 1 && !out.includes(tag)) out.push(tag);
  }
  // borne à 10 par sécurité
  return out.slice(0, 10);
}

function normalizeSteps(steps: unknown, maxChars: number, minLen = 1, maxLen = 10): string[] {
  const raw = Array.isArray(steps) ? steps : [];
  const trimmed = raw
    .map((s) => (isString(s) ? s.trim() : ""))
    .filter(Boolean)
    .map((s) => (s.length > maxChars ? s.slice(0, maxChars - 1) + "…" : s));
  const n = clamp(trimmed.length, minLen, maxLen);
  return trimmed.slice(0, n);
}

/** Tente d’extraire un JSON d’un contenu pouvant contenir des code fences */
function extractJson(content: string): any {
  const fences = content.match(/```json\s*([\s\S]*?)```/i) || content.match(/```\s*([\s\S]*?)```/);
  const jsonStr = fences ? fences[1] : content;
  return JSON.parse(jsonStr);
}

/** Construit le system prompt selon le type */
function buildSystemPrompt(type: GenType, style: string, brandVoice: string, channel: string) {
  // Contraintes spécifiques
  const T = TYPE_LIMITS;
  return `Tu es Alfie, Directeur Artistique IA expert en création de contenu visuel pour les réseaux sociaux.

Ta mission : générer des textes ULTRA CONCIS, percutants et impeccables en français pour type=${type}.

Tons et règles globales :
- Ton ${brandVoice}, adapté à ${channel}
- Style ${style}
- Toujours clair, actionnable, sans jargon inutile
- Interdiction d'émojis dans la sortie JSON

Contraintes par type :
- HERO :
  - Headline ≤ ${T.hero.headlineMaxWords} mots
  - Subtext concise (utiliser "caption")
  - CTA impératif très court (2–4 mots)
- CAROUSEL :
  - Hook ≤ ${T.carousel.hookMaxWords} mots
  - ${T.carousel.stepsMin}–${T.carousel.stepsMax} steps
  - Chaque step ≤ ${T.carousel.stepMaxChars} caractères (pas de ponctuation superflue)
  - CTA court (2–4 mots)
- INSIGHT :
  - Inclure une métrique brève dans "headline" OU "hook"
  - "caption" = contexte ≤ ${T.insight.contextMaxWords} mots
  - CTA court
- REEL :
  - Hook ≤ ${T.reel.hookMaxWords} mots
  - ${T.reel.stepsMin}–${T.reel.stepsMax} steps (séquences claires)
  - CTA court

⚠️ Exigence de sortie :
- Réponds UNIQUEMENT en JSON valide, **sans texte avant/après**, au format EXACT :
{
  "headline": "...",
  "hook": "...",
  "steps": ["...", "...", "..."],
  "cta": "...",
  "caption": "...",
  "hashtags": ["...", "...", "..."]
}

- Respecte strictement les limites (mots/longueurs/compte de steps). 
- Mets des chaînes vides pour les champs non pertinents au type. 
- Les hashtags doivent être des mots-clés pertinents (max 10), format "#motcle" sans espaces.`;
}

/** Construit le user prompt */
function buildUserPrompt(type: GenType, theme: string) {
  const title = type.toUpperCase();
  return `Génère un ${title} sur le thème : "${theme}"`;
}

/** Post-validation/coercition par type */
function enforceTypeRules(type: GenType, payload: CopyPayload): CopyPayload {
  const out: CopyPayload = { ...payload };

  // Valeurs vides par défaut
  out.headline = isString(out.headline) ? out.headline.trim() : "";
  out.hook = isString(out.hook) ? out.hook.trim() : "";
  out.cta = isString(out.cta) ? out.cta.trim() : "";
  out.caption = isString(out.caption) ? out.caption.trim() : "";
  out.hashtags = sanitizeHashtags(out.hashtags);

  if (!Array.isArray(out.steps)) out.steps = [];

  switch (type) {
    case "hero": {
      // Headline courte
      if (wordCount(out.headline || "") > TYPE_LIMITS.hero.headlineMaxWords) {
        out.headline = out.headline!.split(/\s+/).slice(0, TYPE_LIMITS.hero.headlineMaxWords).join(" ");
      }
      // steps non pertinentes → vide
      out.steps = [];
      break;
    }
    case "carousel": {
      // Hook courte
      if (wordCount(out.hook || "") > TYPE_LIMITS.carousel.hookMaxWords) {
        out.hook = out.hook!.split(/\s+/).slice(0, TYPE_LIMITS.carousel.hookMaxWords).join(" ");
      }
      out.steps = normalizeSteps(
        out.steps,
        TYPE_LIMITS.carousel.stepMaxChars,
        TYPE_LIMITS.carousel.stepsMin,
        TYPE_LIMITS.carousel.stepsMax,
      );
      break;
    }
    case "insight": {
      // steps non pertinentes → vide
      out.steps = [];
      // Caption courte
      if (wordCount(out.caption || "") > TYPE_LIMITS.insight.contextMaxWords) {
        out.caption = out.caption!.split(/\s+/).slice(0, TYPE_LIMITS.insight.contextMaxWords).join(" ");
      }
      break;
    }
    case "reel": {
      if (wordCount(out.hook || "") > TYPE_LIMITS.reel.hookMaxWords) {
        out.hook = out.hook!.split(/\s+/).slice(0, TYPE_LIMITS.reel.hookMaxWords).join(" ");
      }
      // Steps borne 3–5, on borne la longueur à ~80 chars pour un sous-titre court
      out.steps = normalizeSteps(out.steps, 80, TYPE_LIMITS.reel.stepsMin, TYPE_LIMITS.reel.stepsMax);
      break;
    }
  }

  // CTA : borne 2–4 mots, sinon on coupe
  if (out.cta) {
    const wc = wordCount(out.cta);
    if (wc > 4) out.cta = out.cta.split(/\s+/).slice(0, 4).join(" ");
  }

  // Sécurité : si tout vide, mettre des placeholders minimalistes
  if (!out.headline && !out.hook) {
    if (type === "hero" || type === "insight") out.headline = "Nouvelle annonce";
    else out.hook = "Idée clé";
  }

  if (!out.cta) out.cta = "En savoir plus";

  return out;
}

/** Appel IA (Lovable Gateway) avec retry simple */
async function callLovable(systemPrompt: string, userPrompt: string, key: string, model = "google/gemini-2.5-flash") {
  const body = JSON.stringify({
    model,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.8,
  });

  const doCall = () =>
    fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body,
    });

  let res = await doCall();
  if (!res.ok && res.status >= 500) {
    // retry unique pour erreurs 5xx
    await new Promise((r) => setTimeout(r, 400));
    res = await doCall();
  }
  return res;
}

Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // --- Auth header ---
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- Supabase service client ---
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(supabaseUrl, supabaseKey);

    // --- Validate user token ---
    const token = authHeader.replace("Bearer ", "").trim();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- Access control (Stripe/granted_by_admin) ---
    const hasAccess = await userHasAccess(authHeader);
    if (!hasAccess) {
      return new Response(JSON.stringify({ error: "Access denied" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- Parse/validate body ---
    const rawBody = (await req.json()) as Partial<GenerateRequest>;
    const type = (rawBody.type || "").toLowerCase() as GenType;
    const theme = (rawBody.theme || "").toString().trim();
    const style = (rawBody.style || DEFAULTS.style).toString().trim();
    const brandVoice = (rawBody.brandVoice || DEFAULTS.brandVoice).toString().trim();
    const channel = (rawBody.channel || DEFAULTS.channel).toString().trim();

    const allowedTypes: GenType[] = ["hero", "carousel", "insight", "reel"];
    if (!allowedTypes.includes(type)) {
      return new Response(JSON.stringify({ error: "Invalid type. Must be one of hero|carousel|insight|reel" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!theme) {
      return new Response(JSON.stringify({ error: "Theme is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY not configured");
    }

    // --- Prompts ---
    const systemPrompt = buildSystemPrompt(type, style, brandVoice, channel);
    const userPrompt = buildUserPrompt(type, theme);

    console.log("[alfie-generate] Calling Lovable AI:", {
      type,
      theme: theme.slice(0, 80),
      style,
      brandVoice,
      channel,
    });

    // --- IA Gateway call ---
    const response = await callLovable(systemPrompt, userPrompt, LOVABLE_API_KEY);

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      console.error("Lovable AI error:", response.status, errorText);

      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Trop de requêtes. Réessayez dans quelques instants." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Crédits insuffisants. Veuillez recharger votre compte Lovable AI." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      throw new Error(`Lovable AI error: ${response.status}`);
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;
    if (!content || !isString(content)) {
      throw new Error("No content generated");
    }

    let parsed: CopyPayload;
    try {
      parsed = extractJson(content);
    } catch (e) {
      console.error("Failed to parse AI response as JSON, raw:", content.slice(0, 300));
      // Fallback minimal
      parsed = {
        headline: type === "hero" || type === "insight" ? "Contenu généré" : "",
        hook: type === "carousel" || type === "reel" ? theme.slice(0, 50) : "",
        steps: type === "carousel" || type === "reel" ? ["Étape 1", "Étape 2", "Étape 3"] : [],
        cta: "En savoir plus",
        caption: theme,
        hashtags: ["#marketing", "#design", "#créativité"],
      };
    }

    // Post-validation & coercition par type
    const enforced = enforceTypeRules(type, parsed);

    // (optionnel) journalisation soft
    console.log("[alfie-generate] Generated payload:", {
      type,
      headline: enforced.headline,
      hook: enforced.hook,
      steps: enforced.steps?.length,
      cta: enforced.cta,
      caption: (enforced.caption || "").slice(0, 80),
      hashtags: enforced.hashtags,
    });

    // Réponse finale normalisée
    return new Response(
      JSON.stringify({
        ok: true,
        type,
        content: enforced,
        meta: {
          style,
          brandVoice,
          channel,
          timestamp: new Date().toISOString(),
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("[alfie-generate] Error:", error);
    const msg = error instanceof Error ? error.message : "Une erreur est survenue";
    const status = /Unauthorized/i.test(msg)
      ? 401
      : /Access denied/i.test(msg)
        ? 403
        : /429|Rate limit/i.test(msg)
          ? 429
          : /402|Payment|Crédit/i.test(msg)
            ? 402
            : 500;

    return new Response(
      JSON.stringify({
        error: msg,
      }),
      { status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

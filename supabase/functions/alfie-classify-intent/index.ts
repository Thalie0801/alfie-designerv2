import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type IntentType = "carousel" | "video" | "image" | "credits" | "brandkit" | "open_canva" | "templates" | "other";

interface IntentResponse {
  intent: IntentType;
  confidence: number; // 0..1
  params?: {
    aspect_ratio?: "1:1" | "4:5" | "9:16" | "16:9";
    slides?: number;
    is_approval?: boolean;
    language?: "fr" | "en" | "und"; // best-guess
    matched?: string; // motif qui a déclenché l’intent
    keywords?: string[]; // mots-clés reconnus
  };
  // message brut utile côté debug
  debug?: {
    normalized: string;
  };
}

/** Heuristique simple de langue */
function detectLanguage(msg: string): "fr" | "en" | "und" {
  const frHits = /(carrousel|vidéo|visuel|diaporama|marque|couleur|police|oui|d'accord|vas-y|lance|quels? formats?)/i;
  const enHits = /(carousel|video|visual|slide|brand kit|template|yes|okay|go ahead|which format)/i;
  if (frHits.test(msg)) return "fr";
  if (enHits.test(msg)) return "en";
  return "und";
}

/** Détection d’approbation (OK pour lancer) */
function isApproval(msg: string): boolean {
  const m = msg.trim().toLowerCase();
  const terms = [
    "oui",
    "ok",
    "d'accord",
    "go",
    "je valide",
    "lance",
    "vas-y",
    "parfait",
    "c'est bon",
    "yes",
    "yep",
    "ouais",
    "exact",
    "carrément",
    "absolument",
    "très bien",
    "impec",
    "nickel",
    "top",
  ];
  return terms.some((t) => m === t || m.startsWith(t + " "));
}

/** Extraction d’un aspect-ratio dans un texte libre */
function extractAspectRatio(msg: string): "1:1" | "4:5" | "9:16" | "16:9" | undefined {
  // tolère 1:1, 1/1, 1-1, 1 1 ; idem pour 4:5, 9:16, 16:9
  const ratioRegex = /\b(1\s*[:/-]\s*1|4\s*[:/-]\s*5|9\s*[:/-]\s*16|16\s*[:/-]\s*9)\b/;
  const m = msg.match(ratioRegex);
  if (!m) return undefined;
  const raw = m[1].replace(/\s+/g, "");
  const norm = raw.replace("/", ":").replace("-", ":");
  const allowed = ["1:1", "4:5", "9:16", "16:9"] as const;
  return (allowed.find((r) => r === norm) as any) ?? undefined;
}

/** Extraction d’un nombre de slides */
function extractSlidesCount(msg: string): number | undefined {
  // “5 slides”, “carrousel 7”, “x5”, “6-pages”, “6 pages”
  const patterns = [
    /(?:slides?|pages?)\s*:?\s*(\d{1,2})/i,
    /(?:carrousel|carousel)\s*:?\s*(\d{1,2})/i,
    /\bx\s*(\d{1,2})\b/i,
    /\b(\d{1,2})\s*(slides?|pages?)\b/i,
  ];
  for (const re of patterns) {
    const m = msg.match(re);
    if (m?.[1]) {
      const n = parseInt(m[1], 10);
      if (Number.isFinite(n) && n > 0 && n <= 20) return n; // borne soft
    }
  }
  return undefined;
}

/** Normalisation basique : minuscules + trim (ne supprime pas les accents) */
function normalize(msg: string): string {
  return msg.normalize("NFKC").toLowerCase().trim();
}

serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const contentType = req.headers.get("content-type") || "";
    if (!/application\/json/i.test(contentType)) {
      return new Response(JSON.stringify({ error: "Content-Type must be application/json" }), {
        status: 415,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { user_message } = await req.json();

    if (!user_message || typeof user_message !== "string") {
      return new Response(JSON.stringify({ error: "user_message is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Sécurité: borne max pour éviter logs géants
    const raw = user_message.length > 4000 ? user_message.slice(0, 4000) : user_message;

    const msg = normalize(raw);
    const lang = detectLanguage(msg);
    const approval = isApproval(msg);
    const ratio = extractAspectRatio(msg);
    const slides = extractSlidesCount(msg);

    // Dictionnaires de mots clés
    const k = {
      carousel: /(carrousel|carousel|slides?|diaporama|série)/i,
      video: /(vid[eé]o|video|reel|shorts?|story\s*vid[eé]o|clip)/i,
      image: /(image|visuel|cover|miniature|photo|illustration|banni[eè]re|banner)/i,
      credits: /(cr[ée]dit|quota|woofs?)/i,
      brandkit: /(brand\s*kit|marque|palette|couleurs?|polices?|logo)/i,
      canva: /\bcanva\b/i,
      templates: /(template|mod[èe]le|gabarit|th[èe]me)/i,
    };

    let intent: IntentType = "other";
    let confidence = 0.2;
    let matched = "";
    let keywords: string[] = [];

    if (k.carousel.test(msg)) {
      intent = "carousel";
      confidence = 0.9;
      matched = "carousel";
      keywords = [...keywords, "carousel"];
    } else if (k.video.test(msg)) {
      intent = "video";
      confidence = 0.88;
      matched = "video";
      keywords = [...keywords, "video"];
    } else if (k.image.test(msg)) {
      intent = "image";
      confidence = 0.85;
      matched = "image";
      keywords = [...keywords, "image"];
    } else if (k.credits.test(msg)) {
      intent = "credits";
      confidence = 0.8;
      matched = "credits";
      keywords = [...keywords, "credits"];
    } else if (k.brandkit.test(msg)) {
      intent = "brandkit";
      confidence = 0.75;
      matched = "brandkit";
      keywords = [...keywords, "brandkit"];
    }

    // Post-règles : Canva & templates (si pas déjà classé en génération explicite)
    if (intent === "other" && k.canva.test(msg)) {
      intent = "open_canva";
      confidence = 0.7;
      matched = "canva";
      keywords = [...keywords, "canva"];
    }
    if (intent === "other" && k.templates.test(msg)) {
      intent = "templates";
      confidence = 0.7;
      matched = "templates";
      keywords = [...keywords, "templates"];
    }

    // Bonus de confiance si ratio/slide count présents pour carousel
    if (intent === "carousel") {
      if (ratio) confidence += 0.03;
      if (typeof slides === "number") confidence += 0.03;
      confidence = Math.min(confidence, 0.95);
    }

    // Bonus si approbation (utile pour enchaîner un tool call déjà planifié)
    if (approval && ["carousel", "image", "video"].includes(intent)) {
      confidence = Math.min(0.98, confidence + 0.02);
      keywords = [...keywords, "approval"];
    }

    const result: IntentResponse = {
      intent,
      confidence: Number(confidence.toFixed(2)),
      params: {
        aspect_ratio: ratio,
        slides,
        is_approval: approval,
        language: lang,
        matched: matched || undefined,
        keywords: keywords.length ? keywords : undefined,
      },
      debug: {
        normalized: msg,
      },
    };

    // Logs sobres
    console.log(
      `[Classifier] "${raw.slice(0, 120)}${raw.length > 120 ? "…" : ""}" → ${intent} (${result.confidence})`,
      result.params ? JSON.stringify(result.params) : "",
    );

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("[Classifier] Error:", error);
    return new Response(JSON.stringify({ error: error?.message || "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

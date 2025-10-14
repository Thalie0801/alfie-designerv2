import { NextResponse } from "next/server";
import type { BriefRatio } from "../../../../lib/types/brief";

type JsonRecord = Record<string, unknown>;

export const runtime = "nodejs";

interface GenerateRequestBody {
  prompt?: string;
  deliverable?: "image" | "video" | string;
  ratio?: BriefRatio;
  resolution?: string;
  tone?: string;
  ambiance?: string;
  constraints?: string;
  brandId?: string;
  brandName?: string;
}

const RATIO_HINTS: Record<BriefRatio, string> = {
  "1:1": "square 1080x1080 visual",
  "4:5": "portrait 1080x1350 visual",
  "9:16": "vertical 1080x1920 visual",
  "16:9": "landscape 1920x1080 visual",
};

const SUPPORTED_RATIOS: BriefRatio[] = ["1:1", "4:5", "9:16", "16:9"];

function resolveSupabaseEnv() {
  const url =
    process.env.SUPABASE_URL ??
    process.env.NEXT_PUBLIC_SUPABASE_URL ??
    process.env.SUPABASE_PROJECT_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.SUPABASE_ANON_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    return null;
  }

  return { url, key };
}

async function callSupabaseFallback(prompt: string, ratio: BriefRatio) {
  const supabase = resolveSupabaseEnv();
  if (!supabase) {
    throw new Error("SUPABASE_CONFIG_MISSING");
  }

  const response = await fetch(`${supabase.url}/functions/v1/generate-ai-image`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: supabase.key,
      Authorization: `Bearer ${supabase.key}`,
    },
    body: JSON.stringify({
      prompt,
      aspectRatio: ratio,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`SUPABASE_${response.status}_${text.slice(0, 120)}`);
  }

  const payload = (await response.json()) as JsonRecord;
  const assetUrl = typeof payload.imageUrl === "string" ? payload.imageUrl : undefined;
  const note = typeof payload.message === "string" ? payload.message : undefined;

  if (!assetUrl) {
    throw new Error("SUPABASE_NO_ASSET");
  }

  return { assetUrl, message: note };
}

function buildImagePrompt(body: GenerateRequestBody) {
  const { prompt = "", ratio = "1:1", resolution, tone, ambiance, constraints, brandName } = body;
  const formattedPrompt = prompt.trim();

  const context: string[] = [
    `Design a premium ${RATIO_HINTS[ratio] ?? "social visual"} ready for export at ${resolution ?? "1080p"}.`,
    "Use Lovable AI to produce a clean marketing render that feels crafted by a senior art director.",
  ];

  if (brandName) {
    context.push(`Brand name: ${brandName}.`);
  }
  if (tone && tone.trim().length > 0) {
    context.push(`Tone guidance: ${tone.trim()}.`);
  }
  if (ambiance && ambiance.trim().length > 0) {
    context.push(`Atmosphere or mood: ${ambiance.trim()}.`);
  }
  if (constraints && constraints.trim().length > 0) {
    context.push(`Hard constraints to respect: ${constraints.trim()}.`);
  }

  context.push(
    "Translate any French copy to English prompts for the model while keeping final on-screen text in French if requested.",
    "Respect safe areas for social media (48px inset).",
    formattedPrompt.length > 0
      ? `Creative brief from the user: ${formattedPrompt}`
      : "Invent a tasteful composition aligned with the brand guidance."
  );

  return context.join("\n\n");
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as GenerateRequestBody;
    const { prompt, deliverable } = body;

    if (!prompt || typeof prompt !== "string" || prompt.trim().length === 0) {
      return NextResponse.json(
        { error: "prompt_required", message: "Précise ce que tu veux que Lovable génère." },
        { status: 400 }
      );
    }

    if (deliverable !== "image" && deliverable !== "video") {
      return NextResponse.json(
        {
          message:
            "Je prépare les visuels avec Lovable. La génération vidéo sera activée dès que le fournisseur l'autorise.",
        },
        { status: 200 }
      );
    }

    if (deliverable === "video") {
      return NextResponse.json(
        {
          message:
            "La génération vidéo Lovable arrive très vite. Je peux déjà t'écrire le script ou le storyboard si tu veux !",
        },
        { status: 200 }
      );
    }

    const promptPayload = buildImagePrompt(body);

    const apiKey = process.env.LOVABLE_API_KEY;
    let assetUrl: string | undefined;
    let providerMessage: string | undefined;
    let providerName = "Lovable AI";

    if (apiKey) {
      try {
        const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash-image-preview",
            messages: [
              {
                role: "user",
                content: [
                  {
                    type: "text",
                    text: promptPayload,
                  },
                ],
              },
            ],
            modalities: ["image", "text"],
          }),
        });

        const contentType = response.headers.get("content-type") ?? "";

        if (!response.ok) {
          const errorText = await response.text();
          console.error("[alfie/generate] Lovable error", response.status, errorText);
          const status = response.status;
          const message =
            status === 429
              ? "Lovable est saturé, on réessaie dans une minute ?"
              : status === 402
              ? "Crédits Lovable insuffisants. Mets à jour ton abonnement."
              : undefined;

          if (message) {
            return NextResponse.json({ error: "lovable_error", message }, { status });
          }

          throw new Error(`LOVABLE_${status}_${errorText.slice(0, 120)}`);
        }

        if (!contentType.includes("application/json")) {
          const raw = await response.text();
          throw new Error(`LOVABLE_UNEXPECTED_PAYLOAD_${contentType}_${raw.slice(0, 120)}`);
        }

        const data = (await response.json()) as JsonRecord;
        const rawChoices = Array.isArray((data as { choices?: unknown }).choices)
          ? ((data as { choices?: unknown }).choices as JsonRecord[])
          : [];
        const firstMessage =
          rawChoices[0] && typeof rawChoices[0] === "object" && rawChoices[0]
            ? ((rawChoices[0] as JsonRecord).message as JsonRecord | undefined)
            : undefined;
        const images = Array.isArray(firstMessage?.images)
          ? (firstMessage?.images as JsonRecord[])
          : [];
        const firstImage =
          images[0] && typeof images[0] === "object" ? (images[0] as JsonRecord) : undefined;
        const imageUrlRecord =
          firstImage && typeof firstImage.image_url === "object"
            ? (firstImage.image_url as JsonRecord)
            : undefined;

        if (imageUrlRecord && typeof imageUrlRecord.url === "string") {
          assetUrl = imageUrlRecord.url;
        }

        if (!assetUrl && firstMessage && typeof firstMessage.content_url === "string") {
          assetUrl = firstMessage.content_url as string;
        }

        if (firstMessage && typeof firstMessage.content === "string") {
          providerMessage = (firstMessage.content as string).trim();
        }
      } catch (lovableError) {
        console.warn("[alfie/generate] Lovable gateway failed, trying Supabase fallback", lovableError);
      }
    }

    if (!assetUrl) {
      try {
        const fallbackRatio = SUPPORTED_RATIOS.includes(body.ratio as BriefRatio)
          ? (body.ratio as BriefRatio)
          : "1:1";
        const fallback = await callSupabaseFallback(promptPayload, fallbackRatio);
        assetUrl = fallback.assetUrl;
        providerMessage = fallback.message ?? providerMessage;
        providerName = "Lovable AI (Supabase)";
      } catch (fallbackError) {
        console.error("[alfie/generate] Supabase fallback failed", fallbackError);
        return NextResponse.json(
          {
            error: "asset_generation_failed",
            message: "Impossible de récupérer une image Lovable pour l'instant. Réessaie dans un instant.",
          },
          { status: 502 }
        );
      }
    }

    if (!assetUrl) {
      return NextResponse.json(
        { error: "asset_missing", message: "Lovable n'a pas renvoyé d'image exploitable." },
        { status: 502 }
      );
    }

    return NextResponse.json({
      assetUrl,
      type: "image",
      provider: providerName,
      format: body.resolution ? `${body.ratio ?? ""} — ${body.resolution}`.trim() : undefined,
      message: providerMessage && providerMessage.length > 0 ? providerMessage : undefined,
    });
  } catch (error) {
    console.error("[alfie/generate] Unexpected error", error);
    return NextResponse.json(
      { error: "unexpected", message: "Impossible de parler à Lovable pour le moment." },
      { status: 500 }
    );
  }
}

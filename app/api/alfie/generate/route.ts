import { NextResponse } from "next/server";
import type { BriefRatio } from "../../../../lib/types/brief";

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

    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "lovable_key_missing", message: "Lovable AI n'est pas configuré côté serveur." },
        { status: 500 }
      );
    }

    const promptPayload = buildImagePrompt(body);

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
            content: promptPayload,
          },
        ],
        modalities: ["image", "text"],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[alfie/generate] Lovable error", response.status, errorText);
      const status = response.status;
      const message =
        status === 429
          ? "Lovable est saturé, on réessaie dans une minute ?"
          : status === 402
          ? "Crédits Lovable insuffisants. Mets à jour ton abonnement."
          : "Lovable ne parvient pas à générer ce visuel.";

      return NextResponse.json({ error: "lovable_error", message }, { status: status === 429 || status === 402 ? status : 502 });
    }

    const data = await response.json();
    const assetUrl: string | undefined =
      data?.choices?.[0]?.message?.images?.[0]?.image_url?.url ?? data?.choices?.[0]?.message?.content_url;

    if (!assetUrl) {
      console.error("[alfie/generate] Missing asset in response", JSON.stringify(data));
      return NextResponse.json(
        { error: "asset_missing", message: "Lovable n'a pas renvoyé d'image exploitable." },
        { status: 502 }
      );
    }

    const contentNote: string | undefined = data?.choices?.[0]?.message?.content;

    return NextResponse.json({
      assetUrl,
      type: "image",
      provider: "Lovable AI",
      format: body.resolution ? `${body.ratio ?? ""} — ${body.resolution}`.trim() : undefined,
      message: contentNote && typeof contentNote === "string" && contentNote.trim().length > 0 ? contentNote.trim() : undefined,
    });
  } catch (error) {
    console.error("[alfie/generate] Unexpected error", error);
    return NextResponse.json(
      { error: "unexpected", message: "Impossible de parler à Lovable pour le moment." },
      { status: 500 }
    );
  }
}

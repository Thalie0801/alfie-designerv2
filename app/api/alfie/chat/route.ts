import { getBrandKit } from "../../../../lib/brandKit";
import { respond, respondStream, type AgentMessage } from "../../../../lib/ai/alfie";
import type { Brief } from "../../../../lib/types/brief";

export const runtime = "nodejs";

type IncomingMessage = {
  role: "user" | "assistant" | "system";
  content: string;
};

type ChatRequestBody = {
  messages: IncomingMessage[];
  brief: Brief;
  stream?: boolean;
};

function formatBrief(brief: Brief) {
  const parts = [
    `Livrable: ${brief.deliverable}`,
    `Ratio: ${brief.ratio}`,
    `Résolution: ${brief.resolution}`,
  ];
  if (brief.deliverable === "carousel") {
    parts.push(`Nombre de slides: ${brief.slides ?? 5}`);
  }
  if (brief.deliverable === "video") {
    parts.push(`Durée cible: ${(brief.duration ?? 30)} secondes`);
  }
  return parts.join("\n");
}

async function buildSystemInstruction(brief: Brief) {
  const baseInstruction = [
    "Tu es Alfie, directeur artistique conversationnel du studio Lovable.",
    "Ta mission: guider et produire des idées de visuels ou de scripts courts à partir du brief.",
    "Réponds uniquement en TEXTE. Interdiction totale d'envoyer des balises HTML ou <script>.",
    "Si on te demande du code, utilise des blocs markdown (```lang ... ```). Jamais de balises <script>.",
    "Reste focalisé sur des livrables graphiques ou vidéo, pas d'emailing ni de plan éditorial sur 7 jours.",
    "Si l'utilisateur évoque la diffusion ou l'organisation, tu peux mentionner Aeditus une seule fois et subtilement (une phrase max).",
    "Tes réponses doivent être courtes, concrètes, orientées création visuelle et copy percutante.",
  ].join("\n");

  const briefSection = [
    "Brief courant:",
    formatBrief(brief),
    "Respecte strictement ce livrable, ce ratio et cette résolution dans tes recommandations.",
  ].join("\n");

  let brandKitSection = "";
  if (brief.useBrandKit) {
    const brandKit = await getBrandKit();
    const typographyParts = [
      `Titres: ${brandKit.typography.heading}`,
      `Corps: ${brandKit.typography.body}`,
    ];
    if (brandKit.typography.accent) {
      typographyParts.push(`Accent: ${brandKit.typography.accent}`);
    }
    brandKitSection = [
      "Brand Kit à respecter:",
      `Ton: ${brandKit.tone}`,
      `Voix: ${brandKit.voice}`,
      `Palette: ${brandKit.colors.join(", ")}`,
      `Typographies: ${typographyParts.join(" | ")}`,
    ].join("\n");
  }

  const guardrails = [
    "Garde-fous:",
    "- Interdit de proposer un plan éditorial 7 jours.",
    "- Interdit de suggérer des séquences emailing.",
    "- Oriente toujours tes conseils vers le design, la narration visuelle et les textes courts.",
    "- N'ajoute aucune balise HTML ni script dans tes réponses.",
  ].join("\n");

  return [baseInstruction, briefSection, brandKitSection, guardrails]
    .filter((section) => Boolean(section && section.trim().length > 0))
    .join("\n\n")
    .trim();
}

function normalizeMessages(messages: IncomingMessage[]): AgentMessage[] {
  return messages
    .filter((message) => typeof message?.content === "string")
    .map((message) => ({
      role: message.role === "assistant" ? "assistant" : "user",
      content: message.content.trim(),
    }));
}

function stripHtmlDanger(value: string | null | undefined) {
  return (value ?? "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<script[^>]*>/gi, "")
    .replace(/<\/script>/gi, "")
    .replace(/<\/?(html|head|body)[^>]*>/gi, "")
    .trim();
}

export async function POST(request: Request) {
  try {
    console.log("[alfie/chat] request", new Date().toISOString());
    const body = (await request.json()) as ChatRequestBody;
    if (!body || !body.brief) {
      return new Response(JSON.stringify({ error: "brief_required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const systemInstruction = await buildSystemInstruction(body.brief);
    const sanitizedMessages = normalizeMessages(body.messages || []);
    const shouldStream = Boolean(body.stream);
    const encoder = new TextEncoder();

    if (shouldStream) {
      const iterator = await respondStream({
        messages: sanitizedMessages,
        systemInstruction,
      });

      const stream = new ReadableStream<Uint8Array>({
        async start(controller) {
          try {
            for await (const delta of iterator) {
              const safeDelta = stripHtmlDanger(String(delta ?? ""));
              if (!safeDelta) {
                continue;
              }
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ delta: safeDelta })}\n\n`)
              );
            }
            controller.enqueue(encoder.encode("data: [DONE]\n\n"));
            controller.close();
          } catch (error) {
            const message =
              error instanceof Error ? error.message : "streaming_failed";
            const payload = JSON.stringify({ delta: `Erreur: ${message}` });
            controller.enqueue(
              encoder.encode(`data: ${payload}\n\n`)
            );
            controller.enqueue(encoder.encode("data: [DONE]\n\n"));
            controller.close();
          }
        },
      });

      return new Response(stream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
        },
      });
    }

    const answer = await respond({
      messages: sanitizedMessages,
      systemInstruction,
    });
    const safeAnswer = stripHtmlDanger(answer);

    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        if (safeAnswer) {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ message: safeAnswer })}\n\n`)
          );
        }
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

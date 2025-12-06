/**
 * Vertex AI Gemini Image Generation Helper
 * Utilise Gemini 2.5 Flash/Pro pour la génération d'images via Vertex AI
 */

import { getAccessToken } from "./vertexAuth.ts";

export type GeminiImageModel = "flash" | "pro";

const MODEL_MAP: Record<GeminiImageModel, string> = {
  flash: "gemini-2.5-flash-preview-05-20",
  pro: "gemini-2.5-pro-preview-06-05",
};

/**
 * Génère une image via Vertex AI Gemini 2.5
 * @param prompt - Le prompt de génération
 * @param model - "flash" (rapide) ou "pro" (qualité)
 * @returns URL base64 de l'image ou null en cas d'échec
 */
export async function callVertexGeminiImage(
  prompt: string,
  model: GeminiImageModel = "flash"
): Promise<string | null> {
  const projectId = Deno.env.get("VERTEX_PROJECT_ID");
  const location = Deno.env.get("VERTEX_LOCATION") || "europe-west9";
  const serviceAccountJson = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_JSON");

  if (!projectId || !serviceAccountJson) {
    console.warn("[vertexGeminiImage] ⚠️ Missing VERTEX_PROJECT_ID or GOOGLE_SERVICE_ACCOUNT_JSON");
    return null;
  }

  const modelId = MODEL_MAP[model];
  const endpoint = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/${modelId}:generateContent`;

  console.log(`[vertexGeminiImage] 🎨 Calling Vertex AI Gemini ${model} (${modelId})`);

  try {
    const accessToken = await getAccessToken(serviceAccountJson);

    const payload = {
      contents: [
        {
          role: "user",
          parts: [{ text: prompt }],
        },
      ],
      generationConfig: {
        responseModalities: ["IMAGE", "TEXT"],
        temperature: 1.0,
        topP: 0.95,
        topK: 40,
      },
      safetySettings: [
        { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
        { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
        { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
        { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
      ],
    };

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`[vertexGeminiImage] ❌ Vertex AI error ${response.status}:`, errText);
      return null;
    }

    const data = await response.json();
    
    // Extraire l'image base64 de la réponse
    const candidates = data.candidates || [];
    for (const candidate of candidates) {
      const parts = candidate.content?.parts || [];
      for (const part of parts) {
        if (part.inlineData?.data) {
          const mimeType = part.inlineData.mimeType || "image/png";
          const base64Url = `data:${mimeType};base64,${part.inlineData.data}`;
          console.log(`[vertexGeminiImage] ✅ Image generated successfully (${mimeType})`);
          return base64Url;
        }
      }
    }

    console.warn("[vertexGeminiImage] ⚠️ No image found in Vertex AI response");
    return null;
  } catch (error) {
    console.error("[vertexGeminiImage] ❌ Exception:", error);
    return null;
  }
}

/**
 * Vérifie si Vertex AI Gemini est configuré
 */
export function isVertexGeminiConfigured(): boolean {
  return !!(
    Deno.env.get("VERTEX_PROJECT_ID") &&
    Deno.env.get("GOOGLE_SERVICE_ACCOUNT_JSON")
  );
}

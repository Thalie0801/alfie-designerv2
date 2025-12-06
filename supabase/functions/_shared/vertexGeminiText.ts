/**
 * Vertex AI Gemini Text Generation Helper
 * 
 * Priorité 1: Vertex AI Gemini 2.5 Flash/Pro
 * Priorité 2: Lovable AI (fallback uniquement)
 */

import { getAccessToken } from './vertexAuth.ts';

export type GeminiTextModel = "flash" | "flash-lite" | "pro";

const MODEL_MAP: Record<GeminiTextModel, string> = {
  "flash": "gemini-2.5-flash-preview-05-20",
  "flash-lite": "gemini-2.5-flash-lite-preview-06-17",
  "pro": "gemini-2.5-pro-preview-05-06",
};

/**
 * Appelle Vertex AI Gemini pour génération de texte
 */
export async function callVertexGeminiText(
  systemPrompt: string,
  userPrompt: string,
  model: GeminiTextModel = "flash"
): Promise<string | null> {
  const projectId = Deno.env.get("VERTEX_PROJECT_ID");
  const location = Deno.env.get("VERTEX_LOCATION") || "europe-west9";
  const serviceAccountJson = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_JSON");

  if (!projectId || !serviceAccountJson) {
    console.log("[VertexGeminiText] Missing config, skipping Vertex AI");
    return null;
  }

  try {
    const accessToken = await getAccessToken(serviceAccountJson);
    const modelId = MODEL_MAP[model];
    
    const endpoint = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/${modelId}:generateContent`;

    console.log(`[VertexGeminiText] Calling ${modelId}...`);

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          { role: "user", parts: [{ text: userPrompt }] }
        ],
        systemInstruction: {
          parts: [{ text: systemPrompt }]
        },
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 4096,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[VertexGeminiText] API error ${response.status}:`, errorText);
      return null;
    }

    const data = await response.json();
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!content) {
      console.error("[VertexGeminiText] No content in response");
      return null;
    }

    console.log(`[VertexGeminiText] Success with ${modelId}`);
    return content;

  } catch (error) {
    console.error("[VertexGeminiText] Error:", error);
    return null;
  }
}

/**
 * Vérifie si Vertex AI Gemini Text est configuré
 */
export function isVertexGeminiTextConfigured(): boolean {
  return !!(
    Deno.env.get("VERTEX_PROJECT_ID") &&
    Deno.env.get("GOOGLE_SERVICE_ACCOUNT_JSON")
  );
}

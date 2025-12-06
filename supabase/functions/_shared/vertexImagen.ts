/**
 * Vertex AI Imagen 3 Image Generation Helper
 * Utilise Imagen 3 pour la génération d'images via Vertex AI
 * 
 * IMPORTANT: Imagen 3 utilise l'API /predict (pas /generateContent)
 * et est disponible uniquement en us-central1
 */

import { getAccessToken } from "./vertexAuth.ts";

export type ImagenModel = "standard" | "premium";

const MODEL_MAP: Record<ImagenModel, string> = {
  standard: "imagen-3.0-generate-002",  // Imagen 3 Fast - rapide et économique
  premium: "imagen-3.0-generate-001",   // Imagen 3 - qualité maximale
};

/**
 * Génère une image via Vertex AI Imagen 3
 * @param prompt - Le prompt de génération
 * @param aspectRatio - Ratio d'aspect (1:1, 9:16, 16:9, 4:3, 3:4)
 * @param model - "standard" (rapide) ou "premium" (qualité max)
 * @returns URL base64 de l'image ou null en cas d'échec
 */
export async function callVertexImagen(
  prompt: string,
  aspectRatio: string = "1:1",
  model: ImagenModel = "standard"
): Promise<string | null> {
  const projectId = Deno.env.get("VERTEX_PROJECT_ID");
  const location = "us-central1"; // Imagen 3 uniquement disponible ici
  const serviceAccountJson = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_JSON");

  if (!projectId || !serviceAccountJson) {
    console.warn("[vertexImagen] ⚠️ Missing VERTEX_PROJECT_ID or GOOGLE_SERVICE_ACCOUNT_JSON");
    return null;
  }

  const modelId = MODEL_MAP[model];
  // Imagen utilise l'endpoint /predict, pas /generateContent
  const endpoint = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/${modelId}:predict`;

  console.log(`[vertexImagen] 🎨 Calling Vertex AI Imagen 3 ${model} (${modelId})`);
  console.log(`[vertexImagen] 📐 Aspect ratio: ${aspectRatio}`);

  try {
    const accessToken = await getAccessToken(serviceAccountJson);

    // Format de payload pour Imagen 3
    const payload = {
      instances: [
        { prompt }
      ],
      parameters: {
        sampleCount: 1,
        aspectRatio: aspectRatio,
        safetyFilterLevel: "block_some",
        personGeneration: "allow_adult",
        // Mode pour les modèles Imagen 3
        mode: "quality", // ou "speed" pour plus rapide
      },
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
      console.error(`[vertexImagen] ❌ Vertex AI error ${response.status}:`, errText);
      return null;
    }

    const data = await response.json();
    
    // Imagen retourne base64 dans predictions[0].bytesBase64Encoded
    const predictions = data.predictions || [];
    if (predictions.length > 0 && predictions[0].bytesBase64Encoded) {
      const base64Data = predictions[0].bytesBase64Encoded;
      const base64Url = `data:image/png;base64,${base64Data}`;
      console.log(`[vertexImagen] ✅ Image generated successfully via Imagen 3 ${model}`);
      return base64Url;
    }

    console.warn("[vertexImagen] ⚠️ No image found in Imagen 3 response:", JSON.stringify(data).slice(0, 500));
    return null;
  } catch (error) {
    console.error("[vertexImagen] ❌ Exception:", error);
    return null;
  }
}

/**
 * Vérifie si Vertex AI Imagen est configuré
 */
export function isVertexImagenConfigured(): boolean {
  return !!(
    Deno.env.get("VERTEX_PROJECT_ID") &&
    Deno.env.get("GOOGLE_SERVICE_ACCOUNT_JSON")
  );
}

/**
 * Convertit une résolution en aspect ratio pour Imagen
 */
export function resolutionToAspectRatio(resolution?: string): string {
  const ratioMap: Record<string, string> = {
    "1080x1080": "1:1",
    "1080x1350": "4:5",
    "1080x1920": "9:16",
    "1920x1080": "16:9",
    "1080x608": "16:9",
    "608x1080": "9:16",
  };
  return ratioMap[resolution || ""] || "1:1";
}

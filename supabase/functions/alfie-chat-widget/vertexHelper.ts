/**
 * Helper pour appeler Vertex AI (Gemini)
 * Ce code est prêt à être activé quand les secrets Vertex seront configurés
 */

import { getAccessToken } from "../_shared/vertexAuth.ts";

interface VertexMessage {
  role: "user" | "model";
  parts: { text: string }[];
}

// Valid Vertex AI regions
const VALID_VERTEX_LOCATIONS = ['us-central1', 'europe-west1', 'europe-west4', 'europe-west9', 'asia-northeast1', 'asia-southeast1'];

export async function callVertexChat(
  messages: { role: string; content: string }[],
  systemPrompt: string
): Promise<string> {
  const projectId = Deno.env.get("VERTEX_PROJECT_ID");
  const rawLocation = Deno.env.get("VERTEX_LOCATION") || "europe-west9";
  const model = Deno.env.get("VERTEX_CHAT_MODEL") || "gemini-2.5-pro";
  const serviceAccountJson = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_JSON");

  // Validate and normalize location
  const location = VALID_VERTEX_LOCATIONS.includes(rawLocation) ? rawLocation : "europe-west9";
  if (rawLocation && !VALID_VERTEX_LOCATIONS.includes(rawLocation)) {
    console.warn(`⚠️ Invalid VERTEX_LOCATION "${rawLocation}", using default "europe-west9". Valid: ${VALID_VERTEX_LOCATIONS.join(', ')}`);
  }

  if (!projectId || !serviceAccountJson) {
    throw new Error("Vertex AI not configured - missing VERTEX_PROJECT_ID or GOOGLE_SERVICE_ACCOUNT_JSON");
  }

  // 1. Générer un access token depuis le service account
  const accessToken = await getAccessToken(serviceAccountJson);

  // 2. Construire le payload Vertex AI (format Gemini)
  const vertexMessages: VertexMessage[] = messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  const payload = {
    contents: vertexMessages,
    systemInstruction: { parts: [{ text: systemPrompt }] },
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 2048,
    },
  };

  // 3. Appeler l'API Vertex AI
  const endpoint = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/${model}:generateContent`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error("❌ Vertex AI HTTP error:", response.status, error.substring(0, 500));
    throw new Error(`Vertex AI error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
  
  // Logging détaillé pour debug
  console.log("📝 Vertex AI response length:", rawText.length);
  console.log("📝 Vertex AI contains alfie-pack:", rawText.includes("<alfie-pack>"));
  
  if (rawText.length < 50) {
    console.warn("⚠️ Vertex AI returned very short response:", rawText);
  } else if (!rawText.includes("<alfie-pack>")) {
    console.warn("⚠️ Vertex response without pack (first 500 chars):", rawText.substring(0, 500));
  }
  
  return rawText;
}

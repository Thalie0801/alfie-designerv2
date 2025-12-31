/**
 * Edge Function: elevenlabs-music
 * Génère une musique de fond via ElevenLabs Music API
 * Utilisé pour le pipeline vidéo avec musique cohérente sur tout un batch
 */

import { corsHeaders } from "../_shared/cors.ts";

const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY")!;
const CLOUDINARY_CLOUD_NAME = Deno.env.get("CLOUDINARY_CLOUD_NAME")!;
const CLOUDINARY_API_KEY = Deno.env.get("CLOUDINARY_API_KEY")!;
const CLOUDINARY_API_SECRET = Deno.env.get("CLOUDINARY_API_SECRET")!;

interface MusicRequest {
  prompt: string;
  durationSeconds?: number;
  folder?: string;
}

const jsonResponse = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

/**
 * Upload audio vers Cloudinary
 */
async function uploadAudioToCloudinary(
  audioBuffer: ArrayBuffer,
  folder: string
): Promise<{ url: string; publicId: string } | null> {
  console.log("[elevenlabs-music] 📤 Uploading music to Cloudinary...");

  // Convert ArrayBuffer to base64
  const uint8Array = new Uint8Array(audioBuffer);
  let binary = "";
  uint8Array.forEach((byte) => (binary += String.fromCharCode(byte)));
  const base64Audio = `data:audio/mpeg;base64,${btoa(binary)}`;

  const timestamp = Math.floor(Date.now() / 1000);
  const paramsToSign = `folder=${folder}&timestamp=${timestamp}`;

  // Generate signature
  const encoder = new TextEncoder();
  const data = encoder.encode(paramsToSign + CLOUDINARY_API_SECRET);
  const hashBuffer = await crypto.subtle.digest("SHA-1", data);
  const signature = Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  const formData = new FormData();
  formData.append("file", base64Audio);
  formData.append("api_key", CLOUDINARY_API_KEY);
  formData.append("timestamp", String(timestamp));
  formData.append("signature", signature);
  formData.append("folder", folder);
  formData.append("resource_type", "video"); // Cloudinary uses "video" for audio

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/video/upload`,
    { method: "POST", body: formData }
  );

  if (!response.ok) {
    const errText = await response.text();
    console.error("[elevenlabs-music] ❌ Cloudinary upload failed:", errText);
    return null;
  }

  const result = await response.json();
  console.log("[elevenlabs-music] ✅ Music uploaded to Cloudinary:", result.public_id);

  return {
    url: result.secure_url,
    publicId: result.public_id,
  };
}

/**
 * Génère un prompt de musique optimisé à partir du brief
 */
function buildMusicPrompt(userPrompt: string): string {
  // Traduire les indices français en anglais pour ElevenLabs
  const translations: Record<string, string> = {
    "énergique": "energetic upbeat",
    "calme": "calm ambient",
    "professionnel": "corporate professional",
    "luxe": "elegant luxury",
    "fun": "playful fun",
    "inspirant": "inspiring motivational",
    "tech": "modern tech electronic",
    "nature": "organic natural acoustic",
    "sport": "dynamic sports action",
    "mode": "fashion trendy stylish",
  };

  let prompt = userPrompt.toLowerCase();
  for (const [fr, en] of Object.entries(translations)) {
    prompt = prompt.replace(new RegExp(fr, "gi"), en);
  }

  // Ajouter des indices de qualité
  return `${prompt}. Background music, instrumental only, no vocals, professional quality, suitable for social media video.`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body: MusicRequest = await req.json();
    const { prompt, durationSeconds = 30, folder = "background-music" } = body;

    if (!prompt || prompt.trim().length === 0) {
      return jsonResponse({ error: "Missing prompt" }, 400);
    }

    if (!ELEVENLABS_API_KEY) {
      return jsonResponse({ error: "ELEVENLABS_API_KEY not configured" }, 500);
    }

    console.log("[elevenlabs-music] 🎵 START", {
      promptPreview: prompt.slice(0, 50),
      durationSeconds,
    });

    // Construire le prompt optimisé
    const musicPrompt = buildMusicPrompt(prompt);
    console.log("[elevenlabs-music] 🎼 Music prompt:", musicPrompt.slice(0, 100));

    // Appeler ElevenLabs Music API
    const response = await fetch("https://api.elevenlabs.io/v1/music", {
      method: "POST",
      headers: {
        "xi-api-key": ELEVENLABS_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt: musicPrompt,
        duration_seconds: durationSeconds,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("[elevenlabs-music] ❌ ElevenLabs error:", response.status, errText);
      
      // Fallback: retourner une erreur gracieuse
      return jsonResponse({ 
        error: `ElevenLabs music error: ${response.status}`,
        fallback: true,
      }, 500);
    }

    const audioBuffer = await response.arrayBuffer();
    console.log("[elevenlabs-music] ✅ Music generated, size:", audioBuffer.byteLength);

    // Upload vers Cloudinary
    const cloudinaryResult = await uploadAudioToCloudinary(audioBuffer, folder);
    if (!cloudinaryResult) {
      return jsonResponse({ error: "Cloudinary upload failed" }, 500);
    }

    console.log("[elevenlabs-music] ✅ SUCCESS", {
      audioUrl: cloudinaryResult.url.slice(0, 60),
      publicId: cloudinaryResult.publicId,
      durationSeconds,
    });

    return jsonResponse({
      success: true,
      audioUrl: cloudinaryResult.url,
      publicId: cloudinaryResult.publicId,
      durationSeconds,
    });
  } catch (error: unknown) {
    console.error("[elevenlabs-music] ❌ Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return jsonResponse({ error: message }, 500);
  }
});

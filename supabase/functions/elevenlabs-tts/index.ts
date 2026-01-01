/**
 * Edge Function: elevenlabs-tts
 * Génère une voix-off via ElevenLabs Text-to-Speech
 * Utilisé pour le pipeline vidéo avec audio professionnel
 */

import { corsHeaders } from "../_shared/cors.ts";

const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY")!;
const CLOUDINARY_CLOUD_NAME = Deno.env.get("CLOUDINARY_CLOUD_NAME")!;
const CLOUDINARY_API_KEY = Deno.env.get("CLOUDINARY_API_KEY")!;
const CLOUDINARY_API_SECRET = Deno.env.get("CLOUDINARY_API_SECRET")!;

// Voix françaises ElevenLabs
const FRENCH_VOICES: Record<string, string> = {
  "lily-fr": "pFZP5JQG7iQjIQuC4Bku",      // Lily - féminine, douce
  "daniel-fr": "onwK4e9ZLuTAKqWW03F9",    // Daniel - masculine, professionnelle
  "charlotte-fr": "XB0fDUnXU5powFXDhCwa", // Charlotte - féminine, énergique
  "thomas-fr": "GBv7mTt0atIp3Br8iCZE",    // Thomas - masculine, chaleureuse
};

interface TTSRequest {
  text: string;
  voiceId?: string;
  voiceName?: string; // "lily-fr", "daniel-fr", etc.
  uploadToCloudinary?: boolean;
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
  console.log("[elevenlabs-tts] 📤 Uploading audio to Cloudinary...");

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
    console.error("[elevenlabs-tts] ❌ Cloudinary upload failed:", errText);
    return null;
  }

  const result = await response.json();
  console.log("[elevenlabs-tts] ✅ Audio uploaded to Cloudinary:", result.public_id);

  return {
    url: result.secure_url,
    publicId: result.public_id,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body: TTSRequest = await req.json();
    const { text, voiceId, voiceName, uploadToCloudinary = true, folder = "voiceovers" } = body;

    if (!text || text.trim().length === 0) {
      return jsonResponse({ error: "Missing text" }, 400);
    }

    if (!ELEVENLABS_API_KEY) {
      return jsonResponse({ error: "ELEVENLABS_API_KEY not configured" }, 500);
    }

    console.log("[elevenlabs-tts] 🎙️ START", {
      textLength: text.length,
      voiceName,
      voiceId,
    });

    // Résoudre l'ID de voix - voiceId peut être un nom ("charlotte-fr") ou un UUID
    const resolvedVoiceId = 
      FRENCH_VOICES[voiceId as string] ||  // voiceId is a voice name → resolve to UUID
      voiceId ||                            // voiceId is already a UUID → use as-is
      FRENCH_VOICES[voiceName || "daniel-fr"] ||  // Use voiceName if provided
      FRENCH_VOICES["daniel-fr"];           // Default to Daniel (standard French accent)

    // Appeler ElevenLabs TTS API
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${resolvedVoiceId}?output_format=mp3_44100_128`,
      {
        method: "POST",
        headers: {
          "xi-api-key": ELEVENLABS_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text,
          model_id: "eleven_multilingual_v2",
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
            style: 0.3,
            use_speaker_boost: true,
            speed: 1.0,
          },
        }),
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      console.error("[elevenlabs-tts] ❌ ElevenLabs error:", response.status, errText);
      return jsonResponse({ error: `ElevenLabs error: ${response.status}` }, 500);
    }

    const audioBuffer = await response.arrayBuffer();
    console.log("[elevenlabs-tts] ✅ Audio generated, size:", audioBuffer.byteLength);

    // Upload vers Cloudinary si demandé
    if (uploadToCloudinary) {
      const cloudinaryResult = await uploadAudioToCloudinary(audioBuffer, folder);
      if (!cloudinaryResult) {
        return jsonResponse({ error: "Cloudinary upload failed" }, 500);
      }

      console.log("[elevenlabs-tts] ✅ SUCCESS", {
        audioUrl: cloudinaryResult.url.slice(0, 60),
        publicId: cloudinaryResult.publicId,
      });

      return jsonResponse({
        success: true,
        audioUrl: cloudinaryResult.url,
        publicId: cloudinaryResult.publicId,
        durationMs: Math.round((text.length / 15) * 1000), // Estimation ~15 chars/sec
      });
    }

    // Retourner le buffer en base64 si pas d'upload Cloudinary
    const uint8Array = new Uint8Array(audioBuffer);
    let binary = "";
    uint8Array.forEach((byte) => (binary += String.fromCharCode(byte)));
    const base64Audio = btoa(binary);

    return jsonResponse({
      success: true,
      audioContent: base64Audio,
      durationMs: Math.round((text.length / 15) * 1000),
    });
  } catch (error: unknown) {
    console.error("[elevenlabs-tts] ❌ Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return jsonResponse({ error: message }, 500);
  }
});

/**
 * Edge Function: mix-audio-video
 * Combine voix-off + musique de fond + vidéo brute via Cloudinary
 * Pipeline: Video (VEO 3.1 sans audio) + Voiceover (ElevenLabs TTS) + Music (ElevenLabs)
 */

import { corsHeaders } from "../_shared/cors.ts";

const CLOUDINARY_CLOUD_NAME = Deno.env.get("CLOUDINARY_CLOUD_NAME")!;

interface MixAudioVideoRequest {
  videoUrl: string;           // URL vidéo brute (VEO 3.1)
  voiceoverUrl?: string;      // URL audio voix-off (optionnel)
  musicUrl?: string;          // URL musique de fond (optionnel)
  voiceoverVolume?: number;   // 0-100 (défaut: 100)
  musicVolume?: number;       // 0-100 (défaut: 20)
  originalVideoVolume?: number; // 0-100 (défaut: 0) - Volume audio VEO natif (défaut: mute)
  duckingEnabled?: boolean;   // ✅ NEW: Ducking audio (défaut: true)
  outputFormat?: string;      // mp4, webm, etc.
}

/**
 * Génère un hash unique pour identifier un mix audio spécifique (anti-doublon)
 */
function generateAudioMixHash(
  videoUrl: string,
  voiceoverUrl?: string,
  musicUrl?: string,
  settings?: Record<string, unknown>
): string {
  const data = JSON.stringify({
    video: videoUrl,
    voice: voiceoverUrl || null,
    music: musicUrl || null,
    settings: settings || {}
  });
  // Simple hash basé sur le contenu
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return `mix_${Math.abs(hash).toString(36)}`;
}

const jsonResponse = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

/**
 * Extrait le public_id d'une URL Cloudinary
 */
function extractPublicId(url: string): string | null {
  // Format: https://res.cloudinary.com/{cloud}/video/upload/v1234/folder/file.mp4
  const match = url.match(/\/(?:video|raw)\/upload\/(?:v\d+\/)?(.+?)(?:\.[a-z0-9]+)?$/i);
  if (match) {
    return match[1];
  }
  
  // Format simplifié: https://res.cloudinary.com/{cloud}/video/upload/folder/file.mp4
  const simpleMatch = url.match(/\/upload\/(.+?)(?:\.[a-z0-9]+)?$/i);
  return simpleMatch ? simpleMatch[1] : null;
}

/**
 * Construit une URL Cloudinary avec overlay audio
 * Documentation: https://cloudinary.com/documentation/video_manipulation_and_delivery
 */
function buildMixedVideoUrl(
  videoPublicId: string,
  voiceoverPublicId?: string,
  musicPublicId?: string,
  voiceoverVolume: number = 100,
  musicVolume: number = 15,
  originalVideoVolume: number = 0, // ✅ FIX: Default to 0 (strip VEO audio) to avoid doubled audio
  format: string = "mp4"
): string {
  const baseUrl = `https://res.cloudinary.com/${CLOUDINARY_CLOUD_NAME}/video/upload`;
  const transformations: string[] = [];

  // ✅ FIX: Strip ou réduire l'audio de la vidéo source (VEO natif)
  if (originalVideoVolume === 0) {
    // MUTE completement l'audio VEO pour éviter le doublon
    transformations.push(`ac_none`);
    console.log("[buildMixedVideoUrl] 🔇 Stripping VEO audio completely (ac_none)");
  } else if (originalVideoVolume < 100) {
    transformations.push(`e_volume:${originalVideoVolume}`);
  }

  // Ajouter la voix-off si fournie
  if (voiceoverPublicId) {
    // l_video:folder:file = overlay audio, e_volume:X = volume en %
    const voiceoverId = voiceoverPublicId.replace(/\//g, ":");
    transformations.push(`l_video:${voiceoverId},fl_layer_apply,e_volume:${voiceoverVolume}`);
  }

  // Ajouter la musique de fond si fournie
  if (musicPublicId) {
    const musicId = musicPublicId.replace(/\//g, ":");
    transformations.push(`l_video:${musicId},fl_layer_apply,e_volume:${musicVolume}`);
  }

  // Construire l'URL finale
  const transformStr = transformations.length > 0 ? transformations.join("/") + "/" : "";
  return `${baseUrl}/${transformStr}${videoPublicId}.${format}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body: MixAudioVideoRequest = await req.json();
    const {
      videoUrl,
      voiceoverUrl,
      musicUrl,
      voiceoverVolume = 100,
      musicVolume = 20,
      originalVideoVolume = 30,
      outputFormat = "mp4",
    } = body;

    if (!videoUrl) {
      return jsonResponse({ error: "Missing videoUrl" }, 400);
    }

    // Au moins un audio doit être fourni
    if (!voiceoverUrl && !musicUrl) {
      return jsonResponse({ error: "At least voiceoverUrl or musicUrl is required" }, 400);
    }
    
    // ✅ Générer l'audio_mix_hash pour éviter les doublons
    const audioMixHash = generateAudioMixHash(videoUrl, voiceoverUrl, musicUrl, {
      voiceoverVolume,
      musicVolume,
      originalVideoVolume,
      duckingEnabled: (body as any).duckingEnabled ?? true,
    });

    console.log("[mix-audio-video] 🎬 START", {
      hasVideo: !!videoUrl,
      hasVoiceover: !!voiceoverUrl,
      hasMusic: !!musicUrl,
      voiceoverVolume,
      musicVolume,
      originalVideoVolume,
      audioMixHash,
    });

    // Extraire les public_ids
    const videoPublicId = extractPublicId(videoUrl);
    if (!videoPublicId) {
      return jsonResponse({ error: "Could not extract video public_id from URL" }, 400);
    }

    const voiceoverPublicId = voiceoverUrl ? extractPublicId(voiceoverUrl) : undefined;
    const musicPublicId = musicUrl ? extractPublicId(musicUrl) : undefined;

    console.log("[mix-audio-video] 📎 Public IDs:", {
      video: videoPublicId,
      voiceover: voiceoverPublicId,
      music: musicPublicId,
    });

    // Construire l'URL de la vidéo mixée
    const mixedVideoUrl = buildMixedVideoUrl(
      videoPublicId,
      voiceoverPublicId ?? undefined,
      musicPublicId ?? undefined,
      voiceoverVolume,
      musicVolume,
      originalVideoVolume,
      outputFormat
    );

    console.log("[mix-audio-video] ✅ SUCCESS", {
      mixedVideoUrl: mixedVideoUrl.slice(0, 80),
    });

    return jsonResponse({
      success: true,
      mixedVideoUrl,
      audioMixHash, // ✅ Retourner le hash pour traçabilité
      components: {
        video: videoPublicId,
        voiceover: voiceoverPublicId || null,
        music: musicPublicId || null,
      },
    });
  } catch (error: unknown) {
    console.error("[mix-audio-video] ❌ Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return jsonResponse({ error: message }, 500);
  }
});

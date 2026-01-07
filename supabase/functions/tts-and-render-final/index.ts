/**
 * Edge Function: tts-and-render-final
 * Post-production: TTS + Cloudinary overlays timés + Mixage audio + SRT
 */

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const CLOUDINARY_CLOUD_NAME = Deno.env.get("CLOUDINARY_CLOUD_NAME")!;
const CLOUDINARY_API_KEY = Deno.env.get("CLOUDINARY_API_KEY")!;
const CLOUDINARY_API_SECRET = Deno.env.get("CLOUDINARY_API_SECRET")!;
const INTERNAL_FN_SECRET = Deno.env.get("INTERNAL_FN_SECRET");

// TTS Provider - OpenAI par défaut, fallback sur Lovable AI
const TTS_PROVIDER = Deno.env.get("TTS_PROVIDER") || "lovable";
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

const jsonResponse = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

interface OverlaySpec {
  lines: string[];
  style: {
    font?: string;
    size?: number;
    color?: string;
    stroke?: string;
    position?: string;
  };
  timings: number[];
}

interface TTSRenderRequest {
  renderId: string;
  baseVideoUrl?: string;
  baseCloudinaryId?: string;
  voiceoverText?: string;
  overlaySpec?: OverlaySpec;
  userId?: string;
}

/**
 * Génère le SRT depuis les lignes et timings
 */
function generateSrt(lines: string[], timings: number[]): string {
  const formatTime = (seconds: number): string => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 1000);
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")},${String(ms).padStart(3, "0")}`;
  };

  return lines
    .map((line, i) => {
      const start = formatTime(timings[i] || i * 2);
      const end = formatTime(timings[i + 1] || (i + 1) * 2);
      return `${i + 1}\n${start} --> ${end}\n${line}\n`;
    })
    .join("\n");
}

/**
 * Génère audio TTS via OpenAI ou fallback
 */
async function generateTTS(text: string): Promise<string | null> {
  console.log("[tts-and-render] 🎤 Generating TTS...");
  
  // Essayer OpenAI d'abord si disponible
  if (TTS_PROVIDER === "openai" && OPENAI_API_KEY) {
    try {
      const response = await fetch("https://api.openai.com/v1/audio/speech", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "tts-1",
          input: text,
          voice: "alloy",
          response_format: "mp3",
        }),
      });

      if (response.ok) {
        const arrayBuffer = await response.arrayBuffer();
        const base64Audio = btoa(
          Array.from(new Uint8Array(arrayBuffer))
            .map(b => String.fromCharCode(b))
            .join("")
        );
        console.log("[tts-and-render] ✅ TTS generated via OpenAI");
        return `data:audio/mp3;base64,${base64Audio}`;
      }
      console.warn("[tts-and-render] OpenAI TTS failed, trying fallback...");
    } catch (error) {
      console.warn("[tts-and-render] OpenAI TTS error:", error);
    }
  }

  // Fallback: pas de TTS (audio Veo sera utilisé ou silence)
  console.warn("[tts-and-render] ⚠️ No TTS available, returning null");
  return null;
}

/**
 * Upload audio vers Cloudinary (resource_type: video pour audio)
 */
async function uploadAudioToCloudinary(base64Audio: string, folder: string): Promise<{ url: string; publicId: string } | null> {
  console.log("[tts-and-render] 📤 Uploading audio to Cloudinary...");
  
  const timestamp = Math.floor(Date.now() / 1000);
  const paramsToSign = `folder=${folder}&resource_type=video&timestamp=${timestamp}`;
  
  const encoder = new TextEncoder();
  const data = encoder.encode(paramsToSign + CLOUDINARY_API_SECRET);
  const hashBuffer = await crypto.subtle.digest("SHA-1", data);
  const signature = Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");

  const formData = new FormData();
  formData.append("file", base64Audio);
  formData.append("api_key", CLOUDINARY_API_KEY);
  formData.append("timestamp", String(timestamp));
  formData.append("signature", signature);
  formData.append("folder", folder);
  formData.append("resource_type", "video");

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/video/upload`,
    { method: "POST", body: formData }
  );

  if (!response.ok) {
    const errText = await response.text();
    console.error("[tts-and-render] ❌ Audio upload failed:", errText);
    return null;
  }

  const result = await response.json();
  console.log("[tts-and-render] ✅ Audio uploaded:", result.public_id);
  
  return {
    url: result.secure_url,
    publicId: result.public_id,
  };
}

/**
 * Construit l'URL Cloudinary avec overlays timés + audio
 */
function buildFinalVideoUrl(
  basePublicId: string,
  overlaySpec: OverlaySpec | null,
  audioPublicId: string | null
): string {
  const transformations: string[] = [];
  
  // Base: 1080x1920 vertical
  transformations.push("w_1080,h_1920,c_fill");
  
  // Text overlays timés
  if (overlaySpec && overlaySpec.lines.length > 0) {
    const style = overlaySpec.style || {};
    const font = style.font || "Montserrat";
    const size = style.size || 72;
    const color = style.color || "white";
    const strokeColor = style.stroke || "black";
    const position = style.position || "south";
    const yOffset = position === "center" ? 0 : 220;
    
    overlaySpec.lines.forEach((line, i) => {
      if (!line.trim()) return;
      
      const startTime = overlaySpec.timings[i] || i * 2;
      const endTime = overlaySpec.timings[i + 1] || (i + 1) * 2;
      
      // Encoder le texte pour URL Cloudinary
      const encodedText = encodeURIComponent(line.replace(/,/g, "，").replace(/\//g, "⁄"));
      
      // Format: l_text:font_size_weight:text,co_color,e_outline:stroke,g_position,y_offset,so_start,eo_end
      const overlay = `l_text:${font}_${size}_bold:${encodedText},co_${color},e_outline:6:color_${strokeColor},g_${position},y_${yOffset},so_${startTime},eo_${endTime}`;
      transformations.push(overlay);
    });
  }
  
  // Audio overlay
  if (audioPublicId) {
    // Format Cloudinary pour audio overlay sur vidéo
    const audioOverlay = `l_video:${audioPublicId.replace(/\//g, ":")},fl_layer_apply`;
    transformations.push(audioOverlay);
  }
  
  // Format final
  transformations.push("f_mp4");
  
  const url = `https://res.cloudinary.com/${CLOUDINARY_CLOUD_NAME}/video/upload/${transformations.join("/")}/${basePublicId}`;
  return url;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body: TTSRenderRequest = await req.json();
    const { renderId, baseVideoUrl, baseCloudinaryId, voiceoverText, overlaySpec, userId } = body;

    if (!renderId) {
      return jsonResponse({ error: "Missing renderId" }, 400);
    }

    // Auth check
    const internalSecret = req.headers.get("x-internal-secret");
    const isInternalCall = internalSecret === INTERNAL_FN_SECRET;
    
    if (!isInternalCall && !userId) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    console.log("[tts-and-render] 🚀 START", {
      renderId,
      hasVoiceover: !!voiceoverText,
      overlayLines: overlaySpec?.lines?.length || 0,
    });

    // Fetch render data
    const { data: render, error: fetchError } = await supabase
      .from("video_renders")
      .select("*")
      .eq("id", renderId)
      .maybeSingle();

    if (fetchError || !render) {
      return jsonResponse({ error: "Render not found" }, 404);
    }

    // Use provided values or fall back to stored values
    const effectiveVoiceoverText = voiceoverText || render.voiceover_text;
    const effectiveOverlaySpec = overlaySpec || render.overlay_spec as OverlaySpec | null;
    const effectiveBaseCloudinaryId = baseCloudinaryId || render.cloudinary_base_id;

    if (!effectiveBaseCloudinaryId) {
      await supabase
        .from("video_renders")
        .update({ status: "failed", error: "Missing base video", error_step: "rendering" })
        .eq("id", renderId);
      return jsonResponse({ error: "Missing base video cloudinary ID" }, 400);
    }

    // Update status
    await supabase
      .from("video_renders")
      .update({ status: "rendering" })
      .eq("id", renderId);

    // 1. Generate TTS if voiceover text provided
    let audioPublicId: string | null = null;
    if (effectiveVoiceoverText) {
      const audioBase64 = await generateTTS(effectiveVoiceoverText);
      if (audioBase64) {
        const folder = `video-audio/${render.user_id}`;
        const audioResult = await uploadAudioToCloudinary(audioBase64, folder);
        if (audioResult) {
          audioPublicId = audioResult.publicId;
          await supabase
            .from("video_renders")
            .update({ 
              status: "tts_done",
              cloudinary_audio_id: audioPublicId 
            })
            .eq("id", renderId);
        }
      }
    }

    // 2. Build final video URL with overlays + audio
    const finalVideoUrl = buildFinalVideoUrl(
      effectiveBaseCloudinaryId,
      effectiveOverlaySpec,
      audioPublicId
    );

    console.log("[tts-and-render] 🎬 Final video URL:", finalVideoUrl.slice(0, 100));

    // 3. Generate SRT
    let srt = "";
    if (effectiveOverlaySpec && effectiveOverlaySpec.lines.length > 0) {
      srt = generateSrt(effectiveOverlaySpec.lines, effectiveOverlaySpec.timings);
      console.log("[tts-and-render] 📝 SRT generated:", srt.slice(0, 100));
    }

    // 4. Update render as done
    await supabase
      .from("video_renders")
      .update({
        status: "done",
        cloudinary_final_url: finalVideoUrl,
        srt,
      })
      .eq("id", renderId);

    console.log("[tts-and-render] ✅ SUCCESS");

    return jsonResponse({
      success: true,
      finalUrl: finalVideoUrl,
      srt,
      audioPublicId,
    });

  } catch (error: unknown) {
    console.error("[tts-and-render] ❌ Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return jsonResponse({ error: message }, 500);
  }
});

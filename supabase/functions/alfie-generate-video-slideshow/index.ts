import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type SlideInput = {
  prompt?: string;
  text?: string;
  // tu peux ajouter d'autres champs (style, brand hints, etc.)
};

function assertArray<T>(v: unknown): v is T[] {
  return Array.isArray(v);
}

function hex(buf: ArrayBuffer) {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function sha1(text: string) {
  const data = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-1", data);
  return hex(digest);
}

/**
 * Signature Cloudinary:
 * - Filtrer les params non vides
 * - Trier alphabétiquement
 * - Joindre "k=v" par "&"
 * - SHA1(string_to_sign + api_secret)
 */
async function cloudinarySign(params: Record<string, string | number | undefined | null>, apiSecret: string) {
  const toSign = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join("&");

  return await sha1(toSign + apiSecret);
}

async function cloudinaryUploadImageFromUrl(opts: {
  fileUrl: string;
  folder: string;
  publicId?: string;
  tags?: string;
  context?: string;
  cloudName: string;
  apiKey: string;
  apiSecret: string;
}) {
  const timestamp = Math.floor(Date.now() / 1000);

  const params = {
    timestamp,
    folder: opts.folder,
    public_id: opts.publicId,
    tags: opts.tags,
    context: opts.context,
  };

  const signature = await cloudinarySign(params, opts.apiSecret);

  const fd = new FormData();
  fd.append("file", opts.fileUrl);
  fd.append("api_key", opts.apiKey);
  fd.append("timestamp", String(timestamp));
  fd.append("signature", signature);
  if (opts.folder) fd.append("folder", opts.folder);
  if (opts.publicId) fd.append("public_id", opts.publicId);
  if (opts.tags) fd.append("tags", opts.tags);
  if (opts.context) fd.append("context", opts.context);

  const res = await fetch(`https://api.cloudinary.com/v1_1/${opts.cloudName}/image/upload`, {
    method: "POST",
    body: fd,
  });
  if (!res.ok) {
    const msg = await res.text().catch(() => "");
    throw new Error(`Cloudinary upload failed: ${res.status} ${msg}`);
  }
  return await res.json();
}

/**
 * Construit un slideshow MP4 à partir d'une liste de public_ids d'images.
 * Cloudinary endpoint: /image/multi
 * NB: "multi" peut sortir mp4/gif/webm et accepte transformations (w,h,c_fit,delay pour GIF).
 * En MP4, la durée par frame est approximée par "duration" global. On fournit "duration" total.
 */
async function cloudinaryCreateSlideshow(opts: {
  publicIds: string[];
  cloudName: string;
  apiKey: string;
  apiSecret: string;
  width: number;
  height: number;
  /**
   * Durée totale de la vidéo (secondes).
   * Par ex. 12s si 6 slides * 2s par slide.
   */
  totalDurationSec: number;
  /**
   * Dossier / public_id cible de l’asset animé
   */
  outFolder: string;
  outPublicId?: string;
  /**
   * Transformation d'entrée (cadre)
   */
  cropMode?: "fit" | "fill" | "pad" | "fill_pad";
}) {
  if (!opts.publicIds.length) throw new Error("No public_ids to merge");

  const timestamp = Math.floor(Date.now() / 1000);

  // Pour garder l'ordre, on passe explicitement public_ids
  // On force format mp4 + transformation pour 1280x720
  const params = {
    public_ids: opts.publicIds.join(","),
    format: "mp4",
    timestamp,
    transformation: `w_${opts.width},h_${opts.height},c_${opts.cropMode ?? "fit"}`,
    // "duration" total du slideshow (dépend du support multi MP4)
    duration: opts.totalDurationSec,
    // Stockage final :
    folder: opts.outFolder,
    public_id: opts.outPublicId,
  };

  const signature = await cloudinarySign(params, opts.apiSecret);

  const fd = new FormData();
  fd.append("public_ids", params.public_ids);
  fd.append("format", params.format);
  fd.append("timestamp", String(timestamp));
  fd.append("api_key", opts.apiKey);
  fd.append("signature", signature);
  fd.append("transformation", params.transformation);
  if (params.duration) fd.append("duration", String(params.duration));
  if (params.folder) fd.append("folder", params.folder);
  if (params.public_id) fd.append("public_id", params.public_id);

  const res = await fetch(`https://api.cloudinary.com/v1_1/${opts.cloudName}/image/multi`, {
    method: "POST",
    body: fd,
  });
  if (!res.ok) {
    const msg = await res.text().catch(() => "");
    throw new Error(`Cloudinary multi failed: ${res.status} ${msg}`);
  }
  return await res.json();
}

serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing authorization header");

    const token = authHeader.replace("Bearer ", "").trim();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token);
    if (userError || !user) throw new Error("Unauthorized");

    const {
      slides,
      narration,
      brandId,
      orderId,
      title,
      // options facultatives
      secondsPerSlide = 2.0, // 2s par slide
      width = 1280,
      height = 720,
      cropMode = "fit", // "fill" si tu veux crop centré
      folder = "alfie/video_slideshows",
    } = await req.json();

    if (!assertArray<SlideInput>(slides) || slides.length === 0) {
      throw new Error("Slides array is required");
    }

    console.log(`🎥 [Video Slideshow] User=${user.id} slides=${slides.length}`);

    // === Phase 1: Générer les images via ta edge function ===
    console.log("📸 [Phase 1] Generating images with alfie-render-image...");
    const imagePromises = slides.map((slide, index) =>
      supabase.functions.invoke("alfie-render-image", {
        body: {
          provider: "gemini_image", // garde ton provider
          prompt: slide.prompt || slide.text || "",
          brand_id: brandId,
          order_id: orderId,
          format: `${width}x${height}`, // 16:9
          backgroundOnly: false, // on veut des visuels complets
          slideIndex: index,
          totalSlides: slides.length,
          negativePrompt: "low quality, watermark, text artifacts",
        },
        headers: { Authorization: `Bearer ${token}` },
      }),
    );

    const imageResults = await Promise.all(imagePromises);

    // Extraire la première URL valide par slide
    const imageUrls: string[] = imageResults
      .map((r, _idx) => r.data?.data?.image_urls?.[0] || r.data?.imageUrl || r.data?.url)
      .filter((u: any) => typeof u === "string" && u.startsWith("http"));

    if (imageUrls.length !== slides.length) {
      throw new Error(`Only ${imageUrls.length}/${slides.length} images generated successfully`);
    }
    console.log(`✅ [Phase 1] ${imageUrls.length} images ready`);

    // === Phase 2: (Optionnel) TTS via Lovable (si dispo) ===
    let audioUrl: string | null = null;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") || "";
    if (LOVABLE_API_KEY && typeof narration === "string" && narration.trim().length > 0) {
      try {
        console.log("🎤 [Phase 2] Attempt TTS via Lovable...");
        const ttsResp = await fetch("https://ai.gateway.lovable.dev/v1/audio/speech", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-tts", // si indisponible, l'API retournera 4xx → on tolère
            input: narration,
            voice: "female_warm",
          }),
        });

        if (ttsResp.ok) {
          // Dans un vrai flux, tu uploaderais le blob vers Cloud Storage (R2/Cloudinary raw/Supabase storage)
          // Ici on garde la logique optionnelle : placeholder si besoin
          audioUrl = null; // <-- implémentation d'upload à faire selon ton infra
          console.log("✅ [Phase 2] TTS call OK (upload non implémenté) – on continue sans audio mux.");
        } else {
          console.warn("⚠️ [Phase 2] TTS not available, continue without audio");
        }
      } catch (e) {
        console.warn("⚠️ [Phase 2] TTS error:", e);
      }
    } else {
      console.log("ℹ️ [Phase 2] No narration or no LOVABLE_API_KEY → skipping TTS");
    }

    // === Phase 3: Upload des images vers Cloudinary, puis assemblage vidéo (image/multi → MP4) ===
    console.log("☁️ [Phase 3] Uploading images to Cloudinary & building slideshow...");
    const CLOUDINARY_CLOUD_NAME = Deno.env.get("CLOUDINARY_CLOUD_NAME");
    const CLOUDINARY_API_KEY = Deno.env.get("CLOUDINARY_API_KEY");
    const CLOUDINARY_API_SECRET = Deno.env.get("CLOUDINARY_API_SECRET");

    if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
      throw new Error("Cloudinary credentials not configured");
    }

    // Upload ordonné des images → récupérer les public_ids dans l'ordre du slideshow
    const uploadResults: Array<{ public_id: string; secure_url: string }> = [];
    for (let i = 0; i < imageUrls.length; i++) {
      const fileUrl = imageUrls[i];
      const publicId = ["slide", String(i + 1).padStart(2, "0"), Date.now()].join("_");

      const up = await cloudinaryUploadImageFromUrl({
        fileUrl,
        folder,
        publicId,
        tags: `alfie,slideshow,user:${user.id}`,
        context: `user_id=${user.id}|order_id=${orderId ?? ""}|brand_id=${brandId ?? ""}`,
        cloudName: CLOUDINARY_CLOUD_NAME,
        apiKey: CLOUDINARY_API_KEY,
        apiSecret: CLOUDINARY_API_SECRET,
      });
      uploadResults.push({ public_id: up.public_id, secure_url: up.secure_url });
      console.log(`  ↳ uploaded ${i + 1}/${imageUrls.length}: ${up.public_id}`);
    }

    const publicIds = uploadResults.map((u) => u.public_id);

    // Durée totale ≈ nbSlides * secondsPerSlide
    const totalDurationSec = Math.max(1, Math.round(slides.length * secondsPerSlide));

    // On génère le MP4 via /image/multi
    const outPublicId = `slideshow_${Date.now()}`;
    const multi = await cloudinaryCreateSlideshow({
      publicIds,
      cloudName: CLOUDINARY_CLOUD_NAME,
      apiKey: CLOUDINARY_API_KEY,
      apiSecret: CLOUDINARY_API_SECRET,
      width,
      height,
      totalDurationSec,
      outFolder: folder,
      outPublicId,
      cropMode: cropMode as any,
    });

    // multi.secure_url contient normalement la ressource animée (mp4)
    const videoUrl: string =
      multi?.secure_url ||
      `https://res.cloudinary.com/${CLOUDINARY_CLOUD_NAME}/video/upload/${folder}/${outPublicId}.mp4`;

    console.log(`✅ [Phase 3] Slideshow ready: ${videoUrl}`);

    // (Facultatif) Mux audio → Ça nécessite d’uploader l’audio en "video" resource puis de recomposer.
    // Vu les incertitudes TTS et selon ton infra, on laisse la vidéo muette pour l’instant.

    // === Phase 4: Enregistrer en bibliothèque ===
    const { data: asset, error: assetError } = await supabase
      .from("library_assets")
      .insert({
        user_id: user.id,
        brand_id: brandId || null,
        order_id: orderId || null,
        type: "video_slideshow",
        cloudinary_url: videoUrl,
        format: `${width}x${height}`,
        campaign: title || "Video Slideshow",
        status: "completed",
        metadata: {
          slides: slides.length,
          imageUrls,
          cloudinaryPublicIds: publicIds,
          audioUrl, // probablement null tant que non implémenté
          secondsPerSlide,
          totalDurationSec,
          generatedAt: new Date().toISOString(),
        },
      })
      .select()
      .single();

    if (assetError) {
      throw new Error(`Failed to store video asset: ${assetError.message}`);
    }

    console.log(`🎉 [Video Slideshow] Asset stored: ${asset.id}`);

    return new Response(
      JSON.stringify({
        success: true,
        asset_id: asset.id,
        video_url: videoUrl,
        image_urls: imageUrls,
        message: "Slideshow MP4 generated via Cloudinary image/multi. (Audio mux optional, not enabled.)",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("❌ [Video Slideshow] Error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

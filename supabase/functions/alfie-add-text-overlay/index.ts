import { edgeHandler } from "../_shared/edgeHandler.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

interface TextOverlayInput {
  imageUrl: string; // URL distante ou dataURL base64
  overlayText: string; // lignes séparées par \n (1ère = titre, reste = sous-titre)
  brand_id?: string;
  slideIndex?: number;
  totalSlides?: number;
  slideNumber?: string; // ex: "1/5"
  textContrast?: "light" | "dark"; // force clair/foncé
  isLastSlide?: boolean; // ajoute "Swipe →" en bas
  textPosition?: "top" | "center" | "bottom";
  fontSize?: number; // taille de base du titre (par défaut 56)
}

/** Build Cloudinary signature (`string_to_sign`) */
function buildCloudinarySignature(params: Record<string, string | number | undefined>, apiSecret: string) {
  // Cloudinary: tri alphabétique, exclure undefined/empty, concat "key=value" via "&", puis SHA-1 + api_secret
  const filtered = Object.entries(params)
    .filter(([_, v]) => v !== undefined && v !== null && v !== "")
    .sort(([a], [b]) => a.localeCompare(b));
  const toSign = filtered.map(([k, v]) => `${k}=${v}`).join("&");
  return crypto.subtle.digest("SHA-1", new TextEncoder().encode(toSign + apiSecret));
}

function hexFromBuffer(buf: ArrayBuffer) {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Encode texte pour l’overlay Cloudinary */
function encodeText(t: string) {
  // Cloudinary attend un encodage URL strict (y compris espaces, ponctuation)
  return encodeURIComponent(t).replace(/%20/g, "%20");
}

export default {
  async fetch(req: Request) {
    return edgeHandler(req, async ({ jwt, input }) => {
      if (!jwt) throw new Error("MISSING_AUTH");

      const {
        imageUrl,
        overlayText,
        brand_id,
        slideIndex,
        totalSlides,
        slideNumber,
        textContrast = "dark",
        isLastSlide = false,
        textPosition = "center",
        fontSize = 56,
      } = input as TextOverlayInput;

      if (!imageUrl || !overlayText) {
        throw new Error("MISSING_PARAMS: imageUrl and overlayText required");
      }

      // --- Auth utilisateur ---
      const supabaseAuth = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
        global: { headers: { Authorization: `Bearer ${jwt}` } },
      });
      const {
        data: { user },
        error: userError,
      } = await supabaseAuth.auth.getUser();
      if (userError || !user) throw new Error("INVALID_TOKEN");

      const CLOUDINARY_CLOUD_NAME = Deno.env.get("CLOUDINARY_CLOUD_NAME");
      const CLOUDINARY_API_KEY = Deno.env.get("CLOUDINARY_API_KEY");
      const CLOUDINARY_API_SECRET = Deno.env.get("CLOUDINARY_API_SECRET");

      if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
        throw new Error("CLOUDINARY_NOT_CONFIGURED");
      }

      // Couleur texte selon contraste
      const textColor = textContrast === "light" ? "FFFFFF" : "000000";
      const strokeColor = textContrast === "light" ? "000000" : "FFFFFF";

      // Parsing titre / sous-titre
      const lines = overlayText
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);
      const title = lines[0] || "";
      const subtitle = lines.slice(1).join(" ") || "";

      // Positionnement vertical: on y décale l’overlay "g_center" avec y négatif/positif
      // (on reste simple et fiable sans dépendre de w/h au runtime)
      const pos = (() => {
        switch (textPosition) {
          case "top":
            return { titleY: -250, subtitleY: -120, swipeY: 140 };
          case "bottom":
            return { titleY: 0, subtitleY: 120, swipeY: 160 };
          default:
            return { titleY: -100, subtitleY: 50, swipeY: 140 };
        }
      })();

      // Tailles cohérentes
      const titleSize = Math.max(24, Math.min(120, Math.round(fontSize)));
      const subtitleSize = Math.max(18, Math.min(90, Math.round(fontSize * 0.65)));

      // Dossier / public_id déterministes
      const folder = brand_id ? `alfie/${brand_id}/overlays` : `alfie/overlays`;
      const publicIdBase = [
        brand_id || "brand",
        user.id.slice(0, 8),
        typeof slideIndex === "number" ? `s${String(slideIndex).padStart(2, "0")}` : "sxx",
        Date.now(),
      ].join("_");

      try {
        // 1) Upload image de fond vers Cloudinary (accepte URL distante ou dataURL)
        const timestamp = Math.floor(Date.now() / 1000);

        // Tags & context pour le suivi
        const tags = [
          "alfie",
          "overlay",
          brand_id ? `brand:${brand_id}` : "",
          typeof slideIndex === "number" ? `slide_index:${slideIndex}` : "",
          typeof totalSlides === "number" ? `total_slides:${totalSlides}` : "",
        ]
          .filter(Boolean)
          .join(",");

        const context = [
          `user_id=${user.id}`,
          brand_id ? `brand_id=${brand_id}` : "",
          typeof slideIndex === "number" ? `slide_index=${slideIndex}` : "",
          typeof totalSlides === "number" ? `total_slides=${totalSlides}` : "",
        ]
          .filter(Boolean)
          .join("|");

        const uploadParams = {
          timestamp,
          folder,
          public_id: publicIdBase,
          tags,
          context,
        };

        const sigBuf = await buildCloudinarySignature(uploadParams, CLOUDINARY_API_SECRET);
        const signatureHex = hexFromBuffer(sigBuf);

        const uploadFormData = new FormData();
        uploadFormData.append("file", imageUrl); // Cloudinary gère dataURL ou URL distante
        uploadFormData.append("api_key", CLOUDINARY_API_KEY);
        uploadFormData.append("timestamp", String(timestamp));
        uploadFormData.append("folder", folder);
        uploadFormData.append("public_id", publicIdBase);
        if (tags) uploadFormData.append("tags", tags);
        if (context) uploadFormData.append("context", context);
        uploadFormData.append("signature", signatureHex);

        const uploadRes = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, {
          method: "POST",
          body: uploadFormData,
        });

        if (!uploadRes.ok) {
          const txt = await uploadRes.text().catch(() => "");
          throw new Error(`Cloudinary upload failed: ${uploadRes.status} ${txt}`);
        }
        const uploadJson = await uploadRes.json();
        const publicId: string = uploadJson.public_id;
        // console.log('[Text Overlay] Uploaded:', publicId);

        // 2) Construire les overlays textes
        const overlays: string[] = [];

        // Slide number (coin sup droit)
        if (slideNumber) {
          const encodedNumber = encodeText(slideNumber);
          overlays.push(
            [
              `l_text:Arial_40_bold:${encodedNumber}`,
              `co_rgb:${textColor}`,
              `g_north_east`,
              `x_60`,
              `y_60`,
              `e_shadow:50`,
              `e_stroke:co_rgb:${strokeColor}`,
              `e_stroke:inner:2`,
            ].join(","),
          );
        }

        // Titre (centré, wrapping à w=900)
        if (title) {
          const encodedTitle = encodeText(title);
          overlays.push(
            [
              `l_text:Arial_${titleSize}_bold:${encodedTitle}`,
              `co_rgb:${textColor}`,
              `g_center`,
              `y_${pos.titleY}`,
              `w_900`,
              `c_fit`,
              `e_shadow:50`,
              `e_stroke:co_rgb:${strokeColor}`,
              `e_stroke:inner:3`,
            ].join(","),
          );
        }

        // Sous-titre (centré, sous le titre, w plus large)
        if (subtitle) {
          const encodedSubtitle = encodeText(subtitle);
          overlays.push(
            [
              `l_text:Arial_${subtitleSize}:${encodedSubtitle}`,
              `co_rgb:${textColor}`,
              `g_center`,
              `y_${pos.subtitleY}`,
              `w_1100`,
              `c_fit`,
              `e_shadow:50`,
              `e_stroke:co_rgb:${strokeColor}`,
              `e_stroke:inner:2`,
            ].join(","),
          );
        }

        // Dernière slide → "Swipe →" en bas
        if (isLastSlide) {
          const swipeText = encodeText("Swipe →");
          overlays.push(
            [
              `l_text:Arial_48_bold:${swipeText}`,
              `co_rgb:${textColor}`,
              `g_south`,
              `y_${pos.swipeY}`,
              `e_shadow:50`,
              `e_stroke:co_rgb:${strokeColor}`,
              `e_stroke:inner:2`,
            ].join(","),
          );
        }

        const textOverlays = overlays.join("/");
        // Sortie en PNG + sRGB + qualité auto
        const finalUrl = `https://res.cloudinary.com/${CLOUDINARY_CLOUD_NAME}/image/upload/f_png,q_auto:good,cs_srgb/${textOverlays}/${publicId}.png`;

        return {
          image_url: finalUrl,
          meta: {
            slideIndex,
            totalSlides,
            method: "cloudinary",
            publicId,
            folder,
            titleSize,
            subtitleSize,
            textColor: `#${textColor}`,
            strokeColor: `#${strokeColor}`,
            position: textPosition,
          },
        };
      } catch (error: any) {
        console.error("[Text Overlay] Error:", error);
        // Fallback: renvoie l’image sans overlay
        return {
          image_url: imageUrl,
          meta: {
            slideIndex,
            totalSlides,
            method: "fallback_no_text",
            error: String(error?.message || error),
          },
        };
      }
    });
  },
};

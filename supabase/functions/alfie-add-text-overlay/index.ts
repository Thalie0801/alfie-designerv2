import { edgeHandler } from "../_shared/edgeHandler.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

/* ===============================
   Types
================================= */
type Placement = "top" | "center" | "bottom";
type ContrastMode = "light" | "dark" | "auto";

interface TextOverlayInput {
  imageUrl: string; // URL distante ou dataURL base64
  overlayText: string; // lignes séparées par \n (1ère = titre, reste = sous-titre)
  brand_id?: string;
  slideIndex?: number;
  totalSlides?: number;
  slideNumber?: string; // ex: "1/5"
  textContrast?: ContrastMode; // "light" | "dark" | "auto"
  isLastSlide?: boolean; // ajoute "Swipe →" en bas
  textPosition?: Placement;
  fontSize?: number; // taille de base du titre (par défaut 56)
  fontFamily?: string; // ex "Arial" (fallback si non fourni)
}

/* ===============================
   Helpers Cloudinary
================================= */

/** Build Cloudinary signature (`string_to_sign`)
 * IMPORTANT: n'inclure que les paramètres Cloudinary supportés pour la signature,
 * triés alphabétiquement, et surtout NE PAS inclure "file", "api_key", "signature".
 */
function buildCloudinarySignature(params: Record<string, string | number | undefined>, apiSecret: string) {
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
  // Cloudinary attend un encodage URL strict (espaces inclus)
  return encodeURIComponent(t).replace(/%20/g, "%20");
}

/* ===============================
   Helpers génériques
================================= */
function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchWithRetry(url: string, init: RequestInit, retries = 2) {
  let lastErr: any;
  for (let i = 0; i <= retries; i++) {
    try {
      const res = await fetch(url, init);
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(`HTTP ${res.status} ${body}`);
      }
      return res;
    } catch (e) {
      lastErr = e;
      if (i < retries) await sleep(300 * (i + 1));
    }
  }
  throw lastErr;
}

// moyenne approx à partir d'une couleur dominante [r,g,b]
function luminance(rgb: [number, number, number]) {
  const [r, g, b] = rgb.map((v) => {
    const n = v / 255;
    return n <= 0.03928 ? n / 12.92 : Math.pow((n + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b; // WCAG
}

function clampText(s: string, max = 400) {
  const trimmed = s.trim().replace(/\s+/g, " ");
  return trimmed.length > max ? trimmed.slice(0, max - 1) + "…" : trimmed;
}

/* ===============================
   Cloudinary Admin: Auto-contrast
================================= */
async function resolveAutoContrast(
  cloud: string,
  apiKey: string,
  apiSecret: string,
  publicId: string,
): Promise<"light" | "dark"> {
  const endpoint = `https://api.cloudinary.com/v1_1/${cloud}/resources/image/upload?colors=true&public_ids[]=${encodeURIComponent(
    publicId,
  )}`;
  const auth = "Basic " + btoa(`${apiKey}:${apiSecret}`);
  const res = await fetchWithRetry(endpoint, { headers: { Authorization: auth } }, 1);
  const json = await res.json();

  const hex = json?.resources?.[0]?.colors?.[0]?.[0] as string | undefined;
  if (!hex || !/^#?[0-9a-f]{6}$/i.test(hex)) return "dark";
  const clean = hex.startsWith("#") ? hex.slice(1) : hex;
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  const L = luminance([r, g, b] as any);
  // luminance élevée => fond clair => texte foncé
  return L > 0.5 ? "dark" : "light";
}

/* ===============================
   Handler principal
================================= */
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
        fontFamily,
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

        const uploadRes = await fetchWithRetry(
          `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
          { method: "POST", body: uploadFormData },
          2,
        );

        const uploadJson = await uploadRes.json();
        const publicId: string = uploadJson.public_id;

        // 2) Déterminer contraste si "auto"
        let finalContrast: "light" | "dark";
        if (textContrast === "auto") {
          try {
            const auto = await resolveAutoContrast(
              CLOUDINARY_CLOUD_NAME,
              CLOUDINARY_API_KEY,
              CLOUDINARY_API_SECRET,
              publicId,
            );
            finalContrast = auto;
          } catch {
            finalContrast = "dark";
          }
        } else {
          finalContrast = textContrast === "light" ? "light" : "dark";
        }

        // Couleurs
        const textColor = finalContrast === "light" ? "FFFFFF" : "000000";
        const strokeColor = finalContrast === "light" ? "000000" : "FFFFFF";

        // Parsing + garde-fou longueur (évite URL trop longues)
        const lines = overlayText
          .split("\n")
          .map((l) => l.trim())
          .filter(Boolean);

        const rawTitle = lines[0] || "";
        const rawSubtitle = lines.slice(1).join(" ") || "";

        const title = clampText(rawTitle, 200);
        const subtitle = clampText(rawSubtitle, 400);

        // Positionnement
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
        const family = (fontFamily || "Arial").replace(/[^-a-zA-Z0-9_]/g, "");

        // 3) Overlays
        const overlays: string[] = [];

        if (slideNumber) {
          const encodedNumber = encodeText(slideNumber);
          overlays.push(
            [
              `l_text:${family}_40_bold:${encodedNumber}`,
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

        if (title) {
          const encodedTitle = encodeText(title);
          overlays.push(
            [
              `l_text:${family}_${titleSize}_bold:${encodedTitle}`,
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

        if (subtitle) {
          const encodedSubtitle = encodeText(subtitle);
          overlays.push(
            [
              `l_text:${family}_${subtitleSize}:${encodedSubtitle}`,
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

        if (isLastSlide) {
          const swipeText = encodeText("Swipe →");
          overlays.push(
            [
              `l_text:${family}_48_bold:${swipeText}`,
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

        // + Améliorations d'affichage (strip metadata, sRGB, auto DPR)
        const finalUrl =
          `https://res.cloudinary.com/${CLOUDINARY_CLOUD_NAME}/image/upload/` +
          `f_png,fl_force_strip,q_auto:good,cs_srgb,dpr_auto/` +
          `${textOverlays}/${publicId}.png`;

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
            contrastMode: finalContrast,
            fontFamily: family,
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

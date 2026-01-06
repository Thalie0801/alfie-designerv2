import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { corsHeaders } from "../_shared/cors.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const lovableApiKey = Deno.env.get("LOVABLE_API_KEY")!;

interface BrandData {
  name: string;
  niche?: string;
  pitch?: string;
  tagline?: string;
  palette?: { primary?: string; secondary?: string; accent?: string };
  adjectives?: string[];
  tone_sliders?: Record<string, number>;
}

const STRUCTURES = [
  "benefit",
  "proof", 
  "offer",
  "problem_solution",
  "checklist_steps",
] as const;

const VARIATIONS_PER_STRUCTURE = 6;

function buildStructurePrompt(
  structure: string,
  variation: number,
  brandData: BrandData
): string {
  const brandContext = `
BRAND: ${brandData.name}
INDUSTRY: ${brandData.niche || "Business"}
TAGLINE: ${brandData.tagline || ""}
STYLE: ${brandData.adjectives?.join(", ") || "Professional, Modern"}
COLORS: ${brandData.palette?.primary || "#4ECDC4"}, ${brandData.palette?.secondary || "#FF6B6B"}
`;

  const structureInstructions: Record<string, string> = {
    benefit: `
STRUCTURE: BÉNÉFICE CLAIR
Montrer le résultat, la transformation, le "après".
Variation ${variation}/6 - angle différent sur le même bénéfice.
Style: Aspirationnel, inspirant, succès.
Représenter visuellement: accomplissement, croissance, satisfaction.`,

    proof: `
STRUCTURE: PREUVE / RÉASSURANCE  
Créer une atmosphère de confiance et crédibilité.
Variation ${variation}/6 - différent angle de preuve sociale.
Style: Professionnel, fiable, rassurant.
Représenter visuellement: confiance, expertise, résultats.
NOTE: NE PAS utiliser de chiffres spécifiques ou statistiques inventées.`,

    offer: `
STRUCTURE: OFFRE + CTA
Créer un visuel orienté action avec urgence.
Variation ${variation}/6 - différent style de présentation d'offre.
Style: Bold, dynamique, call-to-action.
Représenter visuellement: opportunité, exclusivité, action immédiate.`,

    problem_solution: `
STRUCTURE: PROBLÈME → SOLUTION
Montrer d'abord la frustration/problème puis suggérer la solution.
Variation ${variation}/6 - différent problème ou angle.
Style: Contraste avant/après, transformation.
Représenter visuellement: le passage d'un état négatif à un état positif.`,

    checklist_steps: `
STRUCTURE: CHECKLIST / ÉTAPES
Suggérer un processus, des étapes, une méthodologie.
Variation ${variation}/6 - différent type de progression.
Style: Clair, structuré, actionnable.
Représenter visuellement: ordre, méthode, progression logique.`,
  };

  return `Generate a professional marketing visual for social media.

${brandContext}

${structureInstructions[structure] || structureInstructions.benefit}

CRITICAL REQUIREMENTS:
- 1080x1350 resolution (4:5 ratio for Instagram)
- NO TEXT on the image - text will be added in Canva
- Modern, professional design
- Clear visual hierarchy
- High contrast, scroll-stopping colors
- Leave safe zones for text overlay (top 20%, bottom 20%)
- Use brand colors as accents where appropriate

This visual should be REUSABLE for multiple posts with different text overlays.
Create a visually striking background/scene that supports marketing messaging.

Ultra high resolution, photorealistic quality.`;
}

async function generateImage(prompt: string): Promise<{ url: string; publicId: string } | null> {
  try {
    console.log("[generate-upsell-pack] Generating image...");
    
    const response = await fetch("https://api.lovable.dev/v1/images/generations", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt,
        model: "flux.dev",
        width: 1080,
        height: 1350,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("[generate-upsell-pack] API error:", error);
      return null;
    }

    const data = await response.json();
    console.log("[generate-upsell-pack] Image generated successfully");
    
    return {
      url: data.data?.[0]?.url || data.url,
      publicId: `upsell_${Date.now()}`,
    };
  } catch (error) {
    console.error("[generate-upsell-pack] Generation error:", error);
    return null;
  }
}

async function uploadToCloudinary(imageUrl: string, publicId: string): Promise<string | null> {
  try {
    const cloudName = Deno.env.get("CLOUDINARY_CLOUD_NAME");
    const apiKey = Deno.env.get("CLOUDINARY_API_KEY");
    const apiSecret = Deno.env.get("CLOUDINARY_API_SECRET");

    if (!cloudName || !apiKey || !apiSecret) {
      console.log("[generate-upsell-pack] Cloudinary not configured, using direct URL");
      return imageUrl;
    }

    const timestamp = Math.floor(Date.now() / 1000);
    const signatureString = `folder=alfie-upsell&public_id=${publicId}&timestamp=${timestamp}${apiSecret}`;
    
    const encoder = new TextEncoder();
    const data = encoder.encode(signatureString);
    const hashBuffer = await crypto.subtle.digest("SHA-1", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const signature = hashArray.map(b => b.toString(16).padStart(2, "0")).join("");

    const formData = new FormData();
    formData.append("file", imageUrl);
    formData.append("api_key", apiKey);
    formData.append("timestamp", timestamp.toString());
    formData.append("signature", signature);
    formData.append("public_id", publicId);
    formData.append("folder", "alfie-upsell");

    const uploadResponse = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
      { method: "POST", body: formData }
    );

    if (!uploadResponse.ok) {
      console.error("[generate-upsell-pack] Cloudinary upload failed");
      return imageUrl;
    }

    const uploadResult = await uploadResponse.json();
    return uploadResult.secure_url;
  } catch (error) {
    console.error("[generate-upsell-pack] Cloudinary error:", error);
    return imageUrl;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const { orderId, userId, brandId } = await req.json();

    if (!orderId) {
      throw new Error("orderId required");
    }

    console.log("[generate-upsell-pack] Starting generation for order:", orderId);

    // Update order status to generating
    await supabase
      .from("upsell_orders")
      .update({ status: "generating" })
      .eq("id", orderId);

    // Get brand data
    let brandData: BrandData = { name: "Ma Marque" };
    
    if (brandId) {
      const { data: brand } = await supabase
        .from("brands")
        .select("name, niche, pitch, tagline, palette, adjectives, tone_sliders")
        .eq("id", brandId)
        .single();
      
      if (brand) {
        brandData = brand as BrandData;
      }
    }

    console.log("[generate-upsell-pack] Brand data:", brandData.name);

    let generatedCount = 0;
    const totalVisuals = STRUCTURES.length * VARIATIONS_PER_STRUCTURE;

    // Generate each visual
    for (const structure of STRUCTURES) {
      for (let v = 1; v <= VARIATIONS_PER_STRUCTURE; v++) {
        try {
          console.log(`[generate-upsell-pack] Generating ${structure} v${v}...`);
          
          const prompt = buildStructurePrompt(structure, v, brandData);
          const imageResult = await generateImage(prompt);
          
          if (!imageResult) {
            console.error(`[generate-upsell-pack] Failed to generate ${structure} v${v}`);
            continue;
          }

          // Upload to Cloudinary
          const publicId = `upsell_${orderId}_${structure}_v${v}`;
          const cloudinaryUrl = await uploadToCloudinary(imageResult.url, publicId);

          // Save asset to database
          await supabase.from("upsell_assets").insert({
            upsell_order_id: orderId,
            user_id: userId,
            brand_id: brandId,
            structure,
            variation_index: v,
            format: "4:5",
            cloudinary_url: cloudinaryUrl,
            cloudinary_public_id: publicId,
            file_name: `${structure}_v${v}_4x5.png`,
          });

          generatedCount++;

          // Update progress
          await supabase
            .from("upsell_orders")
            .update({ generated_count: generatedCount })
            .eq("id", orderId);

          console.log(`[generate-upsell-pack] Progress: ${generatedCount}/${totalVisuals}`);

          // Small delay to avoid rate limiting
          await new Promise(r => setTimeout(r, 500));
        } catch (error) {
          console.error(`[generate-upsell-pack] Error generating ${structure} v${v}:`, error);
        }
      }
    }

    // Mark order as completed
    await supabase
      .from("upsell_orders")
      .update({ 
        status: "completed",
        generated_count: generatedCount,
      })
      .eq("id", orderId);

    console.log("[generate-upsell-pack] Generation completed:", generatedCount, "visuals");

    return new Response(
      JSON.stringify({ 
        success: true, 
        generated: generatedCount,
        total: totalVisuals,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[generate-upsell-pack] Error:", error);
    
    // Mark as failed
    const { orderId } = await req.json().catch(() => ({}));
    if (orderId) {
      await supabase
        .from("upsell_orders")
        .update({ status: "failed" })
        .eq("id", orderId);
    }

    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

import { corsHeaders } from "../_shared/cors.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "zod";
import { enrichPromptWithBrandKit } from "../_shared/aiOrchestrator.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Zod schema for input validation
const FreePackRequestSchema = z.object({
  userId: z.string(),
  brandId: z.string(),
  email: z.string().email("Invalid email address").max(255, "Email too long").optional().or(z.literal('')),
  packMode: z.enum(['social', 'conversion']).default('social'),
  brandData: z.object({
    brandName: z.string().min(1, "Brand name required").max(100, "Brand name too long"),
    sector: z.string().min(1, "Sector required").max(50, "Sector too long"),
    styles: z.array(z.string().max(50, "Style too long")).max(10, "Too many styles"),
    colorChoice: z.string().min(1, "Color choice required").max(50, "Color choice too long"),
    fontChoice: z.string().min(1, "Font choice required").max(50, "Font choice too long"),
    objective: z.string().max(500, "Objective too long").optional().default(""),
    topic: z.string().max(500, "Topic too long").optional().default(""),
    cta: z.string().max(100, "CTA too long").optional().default(""),
  }),
}).strict();

type FreePackRequest = z.infer<typeof FreePackRequestSchema>;

// Rate limit constants
const MAX_PACKS_PER_EMAIL = 1;
const MAX_PACKS_PER_IP_24H = 3;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Parse and validate request body
    const rawBody = await req.json();
    const parseResult = FreePackRequestSchema.safeParse(rawBody);
    
    if (!parseResult.success) {
      const errors = parseResult.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
      console.error("[generate-free-pack] Validation failed:", errors);
      return new Response(
        JSON.stringify({ success: false, error: "VALIDATION_ERROR", message: errors }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { userId, brandId, email, packMode, brandData } = parseResult.data;

    console.log("[generate-free-pack] Starting generation for", { userId, brandId, email, packMode });

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get IP address for rate-limiting
    const ipAddress = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() 
      || req.headers.get("x-real-ip") 
      || "unknown";

    // ANTI-ABUSE CHECK 1: Check if email already generated a pack
    if (email) {
      const { data: existingLead } = await supabase
        .from("leads")
        .select("id, generation_count, last_generation_at")
        .eq("email", email.trim().toLowerCase())
        .maybeSingle();

      if (existingLead && existingLead.generation_count >= MAX_PACKS_PER_EMAIL) {
        console.log("[generate-free-pack] Rate limit hit for email:", email);
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: "RATE_LIMIT_EMAIL",
            message: "Tu as déjà reçu ton pack gratuit ! Vérifie tes emails ou connecte-toi pour en créer plus.",
          }),
          {
            status: 429,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
    }

    // ANTI-ABUSE CHECK 2: Check IP-based rate limit (3 per 24h)
    if (ipAddress && ipAddress !== "unknown") {
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      
      const { count } = await supabase
        .from("leads")
        .select("id", { count: "exact", head: true })
        .eq("ip_address", ipAddress)
        .gte("last_generation_at", twentyFourHoursAgo);

      if (count && count >= MAX_PACKS_PER_IP_24H) {
        console.log("[generate-free-pack] Rate limit hit for IP:", ipAddress, "count:", count);
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: "RATE_LIMIT_IP",
            message: "Trop de générations depuis cette connexion. Réessaie dans quelques heures.",
          }),
          {
            status: 429,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
    }

    // Define the 3 assets to generate (order: 1:1, 4:5, 9:16 for sequence)
    const assets = [
      { title: "Post Instagram", ratio: "1:1", width: 1080, height: 1080, index: 0 },
      { title: "Cover", ratio: "4:5", width: 1080, height: 1350, index: 1 },
      { title: "Story", ratio: "9:16", width: 1080, height: 1920, index: 2 },
    ];

    const generatedAssets: Array<{
      title: string;
      ratio: string;
      url: string;
      thumbnailUrl: string;
    }> = [];

    // Build style context from brand data (used for enrichment)
    const styleContext = buildStyleContext(brandData);

    // Generate each asset using Lovable AI
    for (let i = 0; i < assets.length; i++) {
      const asset = assets[i];
      console.log(`[generate-free-pack] Generating ${asset.title} (${packMode} mode)...`);

      // Build base prompt using new ultra-precise prompts
      const basePrompt = packMode === 'conversion' 
        ? buildConversionPromptV2(asset.ratio, asset.index, brandData)
        : buildSocialPromptV2(asset.ratio, brandData);

      // Map colorChoice to actual colors for brand kit
      const colorMap: Record<string, string[]> = {
        warm: ["#FF6B35", "#F7C59F", "#2E4057"],
        cool: ["#4ECDC4", "#45B7D1", "#96CEB4"],
        pastel: ["#FFB5E8", "#B5DEFF", "#DCD3FF"],
        bold: ["#FF006E", "#8338EC", "#3A86FF"],
        neutral: ["#2D3436", "#636E72", "#B2BEC3"],
        auto: ["#4ECDC4", "#FF6B6B", "#F7DC6F"],
      };
      const derivedColors = colorMap[brandData.colorChoice] || colorMap.auto;

      // Build brand kit for enrichment
      const brandKit = {
        name: brandData.brandName,
        colors: derivedColors,
        voice: brandData.styles?.join(", ") || "modern professional",
        niche: brandData.sector,
        style: brandData.styles?.join(", ") || "modern professional",
      };

      // Enrich prompt with brand kit
      const enrichedPrompt = enrichPromptWithBrandKit(basePrompt, brandKit);
      console.log(`[generate-free-pack] Enriched prompt for ${asset.title}:`, enrichedPrompt.substring(0, 200) + "...");

      try {
        // Call Lovable AI API for image generation with professional system prompt
        const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
        
        const systemPrompt = `You are a professional visual artist creating premium social media content for advertising campaigns.

CRITICAL GENERATION RULES:
- Generate EXACTLY ONE single image (no grid, no collage, no multiple frames)
- NO TEXT or writing anywhere on the image - pure visual only
- Create sophisticated, artistic imagery worthy of a premium brand
- High-end advertising aesthetic with cinematic lighting

ANTI-GENERIC RULES (VERY IMPORTANT):
- NO low-effort 3D cartoon characters (avoid Pixar-knockoff style)
- NO generic stock photo compositions (avoid handshakes, light bulbs, gears)
- NO cheesy clip-art elements
- NO floating objects on white backgrounds
- Create ORIGINAL, ARTISTIC, MEMORABLE imagery

VISUAL QUALITY STANDARDS:
- Premium color grading and composition
- Professional photography or high-end illustration quality
- Strong visual hierarchy and focal point
- Cinematic lighting with depth and dimension`;
        
        const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${lovableApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-3-pro-image-preview",
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: enrichedPrompt }
            ],
            modalities: ["image", "text"]
          })
        });

        if (!response.ok) {
          console.error(`[generate-free-pack] API error for ${asset.title}:`, await response.text());
          // Use placeholder on error
          generatedAssets.push({
            title: asset.title,
            ratio: asset.ratio,
            url: `/images/placeholder-${asset.ratio.replace(":", "-")}.jpg`,
            thumbnailUrl: `/images/placeholder-${asset.ratio.replace(":", "-")}.jpg`,
          });
          continue;
        }

        const data = await response.json();
        const imageBase64 = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;

        if (imageBase64) {
          // Upload to Cloudinary
          const cloudinaryUrl = await uploadToCloudinary(imageBase64, `free-pack/${userId}/${asset.ratio.replace(":", "-")}`);
          
          generatedAssets.push({
            title: asset.title,
            ratio: asset.ratio,
            url: cloudinaryUrl,
            thumbnailUrl: cloudinaryUrl,
          });

          // Note: Assets are stored in leads.generated_assets, not library_assets
          // (library_assets requires valid UUIDs for user_id)
        } else {
          // Use placeholder if no image generated
          generatedAssets.push({
            title: asset.title,
            ratio: asset.ratio,
            url: `/images/hero-preview.jpg`,
            thumbnailUrl: `/images/hero-preview.jpg`,
          });
        }
      } catch (error) {
        console.error(`[generate-free-pack] Error generating ${asset.title}:`, error);
        generatedAssets.push({
          title: asset.title,
          ratio: asset.ratio,
          url: `/images/hero-preview.jpg`,
          thumbnailUrl: `/images/hero-preview.jpg`,
        });
      }
    }

    console.log("[generate-free-pack] Generation complete", { count: generatedAssets.length, packMode });

    // Store generated assets in the lead record and increment generation_count
    // Also generate a recovery token for email link
    let recoveryToken: string | null = null;
    if (email) {
      const normalizedEmail = email.trim().toLowerCase();
      recoveryToken = crypto.randomUUID();
      
      const { error: updateError } = await supabase
        .from("leads")
        .update({
          generation_count: 1,
          last_generation_at: new Date().toISOString(),
          generated_assets: generatedAssets,
          recovery_token: recoveryToken,
        })
        .eq("email", normalizedEmail);
      
      if (updateError) {
        console.error("[generate-free-pack] Failed to update lead:", updateError);
        recoveryToken = null;
      } else {
        console.log("[generate-free-pack] Stored assets with recovery token for:", normalizedEmail);
      }
    }

    // Queue delivery email via unified email system
    try {
      if (email && recoveryToken) {
        const frontendUrl = Deno.env.get("FRONTEND_URL") || "https://alfie-designer.com";
        const packUrl = `${frontendUrl}/pack?token=${recoveryToken}`;

        await supabase.from("email_queue").insert({
          to_email: email,
          template: "delivery_ready",
          payload: {
            brandName: brandData.brandName,
            pack_url: packUrl,
          },
          run_after: new Date().toISOString(),
        });
        console.log("[generate-free-pack] Queued delivery email with pack_url to", email);

        // Trigger email worker immediately (non-blocking)
        supabase.functions.invoke("email-worker", { body: {} }).catch((err) => {
          console.warn("[generate-free-pack] email-worker trigger failed (non-blocking):", err);
        });
      }
    } catch (emailError) {
      console.error("[generate-free-pack] Email queue error (non-blocking):", emailError);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        assets: generatedAssets,
        packMode,
        message: "Pack generated successfully"
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("[generate-free-pack] Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

function buildStyleContext(brandData: FreePackRequest["brandData"]): string {
  const colorMap: Record<string, string> = {
    warm: "warm tones with oranges, reds, and yellows",
    cool: "cool tones with teals, blues, and greens",
    pastel: "soft pastel colors in pink, blue, and lavender",
    bold: "bold vibrant colors with pink, purple, and blue",
    neutral: "neutral tones with black, gray, and white",
    auto: "harmonious colors matching the brand personality",
  };

  const sectorMap: Record<string, string> = {
    coach: "professional coaching and consulting",
    ecommerce: "modern e-commerce and retail",
    food: "food and restaurant industry",
    beauty: "beauty and wellness",
    tech: "technology and SaaS",
    education: "education and training",
    creative: "creative and artistic",
    other: "professional business",
  };

  return `
    Brand: ${brandData.brandName}
    Industry: ${sectorMap[brandData.sector] || "professional business"}
    Style: ${brandData.styles.join(", ")}
    Colors: ${colorMap[brandData.colorChoice] || "harmonious professional colors"}
    Topic: ${brandData.topic || "general brand content"}
    CTA: ${brandData.cta || "engage with brand"}
  `;
}

// ============================================================================
// V2 PROMPTS - Ultra-precise, consistent, professional smartphone scene
// ============================================================================

const CONVERSION_PROMPTS_V2 = {
  base: `Premium studio product photography, modern checkout/upgrade scene.

MAIN SUBJECT: Premium smartphone in foreground displaying a modern payment/offer UI page with a large visible CTA button (shape + color only, no readable text).

CONVERSION ELEMENTS (visual only, no sentences):
- A "★ 4.9" rating badge (icons OK)
- A small "+2,348" counter (numbers OK)
- A "19€" price tag (numbers OK) suggesting upsell
- A "plan" indicator with 3 dots/circles (starter/pro/premium) without words, just 3 visual levels (e.g., 1/2/3 stars or checkmarks)

STYLE: Premium studio, modern, clean, bright, high-end 3D/photorealistic render.
PALETTE: Pastel candy (mint, soft pink, lavender, peach, light yellow), subtle gradients, light background.
COMPOSITION: Lots of negative space for text overlay, no fantasy illustrations.

CRITICAL COHERENCE: Same exact scene, same objects, same style across all 3 formats - only reframing/cropping changes.

STRICT PROHIBITIONS: No portals, no landscapes, no person with raised arms, no abstract concepts, no readable text, no slogans, no clip-art style, no generic stock photo compositions.`,

  formats: {
    "1:1": "Square format. Centered smartphone, empty zone at top ~20% for text overlay.",
    "4:5": "Vertical 4:5 format. Larger smartphone, empty zone at top ~25% for text overlay.",
    "9:16": "Vertical story 9:16 format. Centered smartphone, empty zone at top ~35%, subtle arrow pointing to CTA."
  }
};

const SOCIAL_PROMPTS_V2 = {
  base: `Premium studio product photography, modern personal brand / social feed scene.

MAIN SUBJECT: Premium smartphone in foreground displaying a cohesive Instagram-style feed grid (9 harmonious posts), with floating engagement elements around it.

BRANDING ELEMENTS (visual only, no sentences):
- A "+12.5K" follower counter (numbers OK)
- Floating heart/like icons
- An engagement indicator "↗ 23%" (numbers OK)
- Color palette dots representing brand colors (3-4 colored circles)
- A stylized profile avatar (round shape, no realistic face)

STYLE: Premium studio, modern, clean, bright, high-end 3D/photorealistic render.
PALETTE: Pastel candy (mint, soft pink, lavender, peach, light yellow), subtle gradients, light background.
COMPOSITION: Lots of negative space for text overlay, no fantasy illustrations.

CRITICAL COHERENCE: Same exact scene, same objects, same style across all 3 formats - only reframing/cropping changes.

STRICT PROHIBITIONS: No portals, no landscapes, no person with raised arms, no abstract concepts, no readable text, no slogans, no clip-art style, no generic stock photo compositions.`,

  formats: {
    "1:1": "Square format. Centered smartphone, empty zone at top ~20% for text overlay.",
    "4:5": "Vertical 4:5 format. Larger smartphone, empty zone at top ~25% for text overlay.",
    "9:16": "Vertical story 9:16 format. Centered smartphone, empty zone at top ~35% for text overlay."
  }
};

function buildSocialPromptV2(ratio: string, brandData: FreePackRequest["brandData"]): string {
  const formatHint = SOCIAL_PROMPTS_V2.formats[ratio as keyof typeof SOCIAL_PROMPTS_V2.formats] || SOCIAL_PROMPTS_V2.formats["1:1"];
  
  return `${SOCIAL_PROMPTS_V2.base}

FORMAT: ${ratio} aspect ratio.
COMPOSITION: ${formatHint}

BRAND CONTEXT:
- Brand: ${brandData.brandName}
- Industry: ${brandData.sector}
- Style personality: ${brandData.styles?.join(", ") || "modern, professional"}
- Topic context: ${brandData.topic || "personal brand content"}`;
}

function buildConversionPromptV2(ratio: string, assetIndex: number, brandData: FreePackRequest["brandData"]): string {
  const formatHint = CONVERSION_PROMPTS_V2.formats[ratio as keyof typeof CONVERSION_PROMPTS_V2.formats] || CONVERSION_PROMPTS_V2.formats["1:1"];
  
  // Marketing sequence: Benefit → Proof → Offer
  const sequenceLabels = [
    "VISUAL 1/3 - BENEFIT: Focus on the transformation/result that clients achieve",
    "VISUAL 2/3 - SOCIAL PROOF: Emphasize trust, credibility, proven results",
    "VISUAL 3/3 - OFFER + CTA: Create urgency and desire to take action now"
  ];
  
  return `${CONVERSION_PROMPTS_V2.base}

FORMAT: ${ratio} aspect ratio.
COMPOSITION: ${formatHint}

MARKETING SEQUENCE: ${sequenceLabels[assetIndex]}

BRAND CONTEXT:
- Brand: ${brandData.brandName}
- Industry: ${brandData.sector}
- Style personality: ${brandData.styles?.join(", ") || "modern, professional"}
- Topic context: ${brandData.topic || "brand offering"}
- CTA context: ${brandData.cta || "take action"}`;
}

async function uploadToCloudinary(base64Data: string, publicId: string): Promise<string> {
  const cloudName = Deno.env.get("CLOUDINARY_CLOUD_NAME");
  const apiKey = Deno.env.get("CLOUDINARY_API_KEY");
  const apiSecret = Deno.env.get("CLOUDINARY_API_SECRET");

  if (!cloudName || !apiKey || !apiSecret) {
    console.warn("[generate-free-pack] Cloudinary not configured, returning base64");
    return base64Data;
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const paramsToSign = `public_id=${publicId}&timestamp=${timestamp}`;
  
  // Create signature
  const encoder = new TextEncoder();
  const data = encoder.encode(paramsToSign + apiSecret);
  const hashBuffer = await crypto.subtle.digest("SHA-1", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const signature = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

  const formData = new FormData();
  formData.append("file", base64Data);
  formData.append("public_id", publicId);
  formData.append("timestamp", timestamp.toString());
  formData.append("api_key", apiKey);
  formData.append("signature", signature);

  const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    console.error("[generate-free-pack] Cloudinary upload error:", await response.text());
    return base64Data;
  }

  const result = await response.json();
  return result.secure_url;
}

import { corsHeaders } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';

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

    // Define the 3 assets to generate
    const assets = [
      { title: "Post Instagram", ratio: "1:1", width: 1080, height: 1080 },
      { title: "Story", ratio: "9:16", width: 1080, height: 1920 },
      { title: "Cover", ratio: "4:5", width: 1080, height: 1350 },
    ];

    const generatedAssets: Array<{
      title: string;
      ratio: string;
      url: string;
      thumbnailUrl: string;
    }> = [];

    // Build style context from brand data
    const styleContext = buildStyleContext(brandData);

    // Generate each asset using Lovable AI
    for (let i = 0; i < assets.length; i++) {
      const asset = assets[i];
      console.log(`[generate-free-pack] Generating ${asset.title} (${packMode} mode)...`);

      const prompt = packMode === 'conversion' 
        ? buildConversionPrompt(asset, brandData, styleContext, i)
        : buildSocialPrompt(asset, brandData, styleContext);

      try {
        // Call Lovable AI API for image generation
        const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
        
        const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${lovableApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-3-pro-image-preview",
            messages: [
              {
                role: "user",
                content: prompt
              }
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

          // Store in library_assets
          await supabase.from("library_assets").insert({
            user_id: userId,
            brand_id: brandId,
            type: "image",
            format: asset.ratio,
            cloudinary_url: cloudinaryUrl,
            tags: ["free-pack", packMode],
            metadata: {
              title: asset.title,
              source: "free-pack",
              packMode,
              brandData,
            }
          });
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

    // Send email with download link
    try {
      if (email) {
        await supabase.functions.invoke("send-pack-email", {
          body: {
            email,
            packType: packMode === 'conversion' ? 'conversion' : 'free',
            brandName: brandData.brandName,
            assets: generatedAssets,
          }
        });
      }
    } catch (emailError) {
      console.error("[generate-free-pack] Email error (non-blocking):", emailError);
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

function buildSocialPrompt(
  asset: { title: string; ratio: string; width: number; height: number },
  brandData: FreePackRequest["brandData"],
  styleContext: string
): string {
  const aspectDesc = asset.ratio === "1:1" ? "square" : asset.ratio === "9:16" ? "vertical portrait" : "vertical";
  
  return `Generate a professional ${aspectDesc} social media visual for a brand.

${styleContext}

Requirements:
- Create a beautiful, eye-catching ${asset.title} visual
- Use the brand's style: ${brandData.styles.join(", ")}
- NO TEXT or writing on the image - pure visual only
- Modern, professional design suitable for social media
- High quality, ${asset.width}x${asset.height} resolution
- Abstract or lifestyle background that represents the brand personality

The image should feel ${brandData.styles.join(", ").toLowerCase()} and appeal to the ${brandData.sector} industry.`;
}

function buildConversionPrompt(
  asset: { title: string; ratio: string; width: number; height: number },
  brandData: FreePackRequest["brandData"],
  styleContext: string,
  assetIndex: number
): string {
  const aspectDesc = asset.ratio === "1:1" ? "square" : asset.ratio === "9:16" ? "vertical portrait" : "vertical";
  
  const conversionAngles = [
    // Visuel 1 : Bénéfice clair
    `Focus: MAIN BENEFIT - What transformation/result does the client get?
     Create a visual that showcases the "after" state, the positive outcome.
     Message: What life looks like AFTER using the product/service.
     Style: Aspirational, inspiring, showing success or satisfaction.`,
    
    // Visuel 2 : Preuve / réassurance
    `Focus: SOCIAL PROOF - Why should they trust you?
     Create a visual that conveys credibility, trust, and results.
     Message: Evidence that the solution works - think testimonials, numbers, success.
     Style: Professional, trustworthy, reassuring.`,
    
    // Visuel 3 : Offre + CTA
    `Focus: OFFER + CALL TO ACTION - What do they do next?
     Create a visual that screams "take action now" with urgency.
     Message: Clear offer presentation with a sense of opportunity.
     Style: Bold, action-oriented, compelling.`,
  ];

  return `Generate a HIGH-CONVERTING ${aspectDesc} marketing visual designed to SELL.

${styleContext}

CONVERSION ANGLE:
${conversionAngles[assetIndex]}

Requirements:
- Create a scroll-stopping ${asset.title} visual designed for paid ads and sales
- This is for CONVERSION, not just branding - it needs to drive action
- Clean, punchy design with clear visual hierarchy
- NO TEXT on image (text will be added in Canva after)
- Professional quality, ${asset.width}x${asset.height} resolution
- Emotional imagery that connects with the target audience
- High contrast, attention-grabbing composition

The image should feel professional and HIGH-VALUE, designed to convert viewers into buyers.
This is for ${brandData.brandName} in the ${brandData.sector} industry.`;
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

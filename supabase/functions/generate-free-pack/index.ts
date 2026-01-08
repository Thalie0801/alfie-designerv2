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

      // Build base prompt
      const basePrompt = packMode === 'conversion' 
        ? buildConversionPrompt(asset, brandData, i)
        : buildSocialPrompt(asset, brandData);

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
        const frontendUrl = Deno.env.get("FRONTEND_URL") || "https://alfie.design";
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

function buildSocialPrompt(
  asset: { title: string; ratio: string; width: number; height: number },
  brandData: FreePackRequest["brandData"]
): string {
  const aspectDesc = asset.ratio === "1:1" ? "square 1:1" : asset.ratio === "9:16" ? "vertical 9:16 story" : "vertical 4:5 cover";
  
  return `Create a stunning premium ${aspectDesc} visual for ${brandData.brandName}, a ${brandData.sector} brand.

CREATIVE DIRECTION:
- Sophisticated, editorial-quality imagery that captures brand essence
- Style: ${brandData.styles?.join(", ") || "modern, professional"} aesthetic
- Create a memorable visual that stands out in a social media feed
- ${asset.width}x${asset.height} resolution, optimized for ${asset.title}

VISUAL APPROACH:
Choose ONE of these approaches based on the brand personality:
- Abstract: Geometric patterns, gradients, or artistic compositions
- Lifestyle: Aspirational scene representing the brand's world
- Conceptual: Metaphorical imagery that evokes the brand's values
- Minimalist: Clean, elegant composition with strong focal point

CRITICAL REQUIREMENTS:
- ABSOLUTELY NO TEXT on the image (text overlay added later in Canva)
- Premium quality worthy of a high-end advertising campaign
- Strong visual identity reflecting ${brandData.sector} industry
- Scroll-stopping composition that captures attention

Topic context: ${brandData.topic || "brand identity and values"}`;
}

function buildConversionPrompt(
  asset: { title: string; ratio: string; width: number; height: number },
  brandData: FreePackRequest["brandData"],
  assetIndex: number
): string {
  const aspectDesc = asset.ratio === "1:1" ? "square 1:1" : asset.ratio === "9:16" ? "vertical 9:16 story" : "vertical 4:5 cover";
  
  const conversionAngles = [
    // Visual 1: BENEFIT - The Transformation
    `VISUAL CONCEPT: "The Transformation"
     
Create a powerful visual showing the RESULT/OUTCOME that clients achieve.
     
SCENE IDEAS (choose the most relevant):
- Person in a moment of achievement, celebration, or breakthrough
- "After" state imagery: calm, success, satisfaction, freedom
- Metaphorical: doors opening, sunrise, reaching summit, crossing finish line
- Emotional: relief, joy, confidence, empowerment
     
MOOD: Aspirational, inspiring, "this could be you", hopeful
COLORS: Warm, inviting, with highlights that draw the eye`,
    
    // Visual 2: PROOF - The Credibility
    `VISUAL CONCEPT: "The Proof"
     
Create imagery that conveys TRUST, EXPERTISE, and PROVEN RESULTS.
     
SCENE IDEAS (choose the most relevant):
- Professional environment suggesting expertise and competence
- Abstract: scales balancing, solid foundations, quality indicators
- Authority symbols: podium, awards, professional workspace
- Community/testimonial feel: people together, satisfaction
     
MOOD: Trustworthy, established, reliable, professional
COLORS: Confident, grounded, with premium feel`,
    
    // Visual 3: OFFER - The Call to Action
    `VISUAL CONCEPT: "The Opportunity"
     
Create urgency and desire to take ACTION NOW.
     
SCENE IDEAS (choose the most relevant):
- Open door to opportunity, gateway to success
- Exclusive access feeling: VIP, behind the curtain, limited
- Momentum: movement, progress, forward motion
- Decision moment: crossroads, choice, now or never
     
MOOD: Bold, exciting, urgent but not aggressive, opportunity-focused
COLORS: High contrast, attention-grabbing, dynamic`,
  ];

  return `Create a HIGH-CONVERTING premium ${aspectDesc} marketing visual for ${brandData.brandName}.

MARKETING OBJECTIVE: This is a SALES visual for paid advertising - it must drive action.

${conversionAngles[assetIndex]}

BRAND CONTEXT:
- Brand: ${brandData.brandName}
- Industry: ${brandData.sector}
- Style: ${brandData.styles?.join(", ") || "modern, professional"}
- Topic: ${brandData.topic || "brand offering"}
- CTA context: ${brandData.cta || "take action"}

CRITICAL REQUIREMENTS:
- ABSOLUTELY NO TEXT on the image (text overlay added later in Canva)
- High-end advertising quality, NOT stock photo or generic AI art
- Emotional connection with target audience
- ${asset.width}x${asset.height} resolution for ${asset.title}
- Scroll-stopping composition with strong visual hierarchy
- Premium color grading and cinematic lighting

This visual must feel like it belongs in a high-budget ad campaign, not a template library.`;
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

import { corsHeaders } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface FreePackRequest {
  userId: string;
  brandId: string;
  email: string;
  brandData: {
    brandName: string;
    sector: string;
    styles: string[];
    colorChoice: string;
    fontChoice: string;
    objective: string;
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { userId, brandId, email, brandData } = await req.json() as FreePackRequest;

    console.log("[generate-free-pack] Starting generation for", { userId, brandId, email });

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

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
    for (const asset of assets) {
      console.log(`[generate-free-pack] Generating ${asset.title}...`);

      const prompt = buildPrompt(asset, brandData, styleContext);

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
            tags: ["free-pack"],
            metadata: {
              title: asset.title,
              source: "free-pack",
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

    console.log("[generate-free-pack] Generation complete", { count: generatedAssets.length });

    // Send email with download link
    try {
      await supabase.functions.invoke("send-pack-email", {
        body: {
          email,
          packType: "free",
          brandName: brandData.brandName,
          assets: generatedAssets,
        }
      });
    } catch (emailError) {
      console.error("[generate-free-pack] Email error (non-blocking):", emailError);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        assets: generatedAssets,
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
  `;
}

function buildPrompt(
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

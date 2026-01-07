import { corsHeaders } from "../_shared/cors.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface CarouselPackRequest {
  userId: string;
  brandId: string;
  email: string;
  sessionId?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { userId, brandId, email, sessionId } = await req.json() as CarouselPackRequest;

    console.log("[generate-carousel-pack] Starting generation for", { userId, brandId, email });

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch brand data
    const { data: brand, error: brandError } = await supabase
      .from("brands")
      .select("*")
      .eq("id", brandId)
      .single();

    if (brandError || !brand) {
      console.error("[generate-carousel-pack] Brand not found:", brandError);
      return new Response(
        JSON.stringify({ success: false, error: "Brand not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate 10 carousel slides
    const slides: Array<{
      index: number;
      title: string;
      subtitle: string;
      body: string;
      imageUrl: string;
    }> = [];

    // First, generate texts for all slides
    const slideTexts = await generateSlideTexts(brand);

    // Then generate images for each slide
    for (let i = 0; i < 10; i++) {
      console.log(`[generate-carousel-pack] Generating slide ${i + 1}/10...`);

      const slideText = slideTexts[i] || {
        title: `Slide ${i + 1}`,
        subtitle: "",
        body: "",
      };

      try {
        const imageUrl = await generateSlideImage(brand, i, slideText);
        
        slides.push({
          index: i,
          title: slideText.title,
          subtitle: slideText.subtitle,
          body: slideText.body,
          imageUrl,
        });
      } catch (error) {
        console.error(`[generate-carousel-pack] Error generating slide ${i + 1}:`, error);
        slides.push({
          index: i,
          title: slideText.title,
          subtitle: slideText.subtitle,
          body: slideText.body,
          imageUrl: "/images/carousel-preview.jpg",
        });
      }
    }

    // Store carousel in library_assets
    const carouselId = crypto.randomUUID();
    
    for (const slide of slides) {
      await supabase.from("library_assets").insert({
        user_id: userId,
        brand_id: brandId,
        carousel_id: carouselId,
        slide_index: slide.index,
        type: "carousel",
        format: "4:5",
        cloudinary_url: slide.imageUrl,
        text_json: {
          title: slide.title,
          subtitle: slide.subtitle,
          body: slide.body,
        },
        tags: ["carousel-pack", "express-19"],
        metadata: {
          source: "express-checkout",
          sessionId,
        }
      });
    }

    // Generate CSV for Canva
    const csvContent = generateCanvaCSV(slides);

    // Queue delivery email via unified email system
    try {
      if (email) {
        await supabase.from("email_queue").insert({
          to_email: email,
          template: "delivery_ready",
          payload: {
            brandName: brand.name,
            packType: "carousel",
            carouselId,
            slideCount: slides.length,
            // Include first few slide images for preview
            previewImages: slides.slice(0, 3).map(s => s.imageUrl).filter(url => !url.startsWith('/')),
          },
          run_after: new Date().toISOString(),
        });
        console.log("[generate-carousel-pack] Queued delivery email to", email);
      }
    } catch (emailError) {
      console.error("[generate-carousel-pack] Email queue error (non-blocking):", emailError);
    }

    console.log("[generate-carousel-pack] Generation complete", { slideCount: slides.length });

    return new Response(
      JSON.stringify({ 
        success: true, 
        carouselId,
        slides,
        csvContent,
        message: "Carousel pack generated successfully"
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("[generate-carousel-pack] Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

async function generateSlideTexts(brand: any): Promise<Array<{ title: string; subtitle: string; body: string }>> {
  const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
  
  const prompt = `Generate content for a 10-slide Instagram carousel for the brand "${brand.name}" in the ${brand.niche || "business"} industry.

Voice/Tone: ${brand.voice || "Professional and engaging"}
Style: ${brand.adjectives?.join(", ") || "Modern, professional"}

Generate exactly 10 slides with this structure:
1. Hook slide (attention-grabbing)
2-8. Value slides (tips, insights, or steps)
9. Summary/recap slide
10. Call-to-action slide

For each slide, provide:
- title (max 40 characters)
- subtitle (max 60 characters)
- body (max 120 characters, 1-2 sentences)

Respond in JSON format:
[
  { "title": "...", "subtitle": "...", "body": "..." },
  ...
]`;

  try {
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          { role: "user", content: prompt }
        ],
      })
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "[]";
    
    // Parse JSON from response
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (error) {
    console.error("[generate-carousel-pack] Error generating texts:", error);
  }

  // Fallback texts
  return Array.from({ length: 10 }, (_, i) => ({
    title: i === 0 ? "Découvrez notre secret" : i === 9 ? "Prêt à commencer ?" : `Conseil #${i}`,
    subtitle: i === 0 ? "Ce qui change tout" : "",
    body: i === 9 ? "Suivez-nous pour plus de conseils !" : "Un conseil pratique pour vous aider.",
  }));
}

async function generateSlideImage(brand: any, index: number, slideText: { title: string; subtitle: string; body: string }): Promise<string> {
  const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");

  const colorContext = brand.palette 
    ? `Use these brand colors: ${JSON.stringify(brand.palette)}`
    : "Use harmonious professional colors";

  const prompt = `Generate a beautiful Instagram post background for image ${index + 1}/10.

Brand: ${brand.name}
Industry: ${brand.niche || "business"}
${colorContext}

This is a 4:5 vertical image (1080x1350px) for Instagram post.
Create an abstract, modern background that:
- Has NO TEXT whatsoever - pure visual only
- Is visually striking and professional
- Works well with text overlay (not too busy)
- Matches the brand personality: ${brand.adjectives?.join(", ") || "professional, modern"}
- Uses subtle gradients or patterns

The slide will have this content overlaid: "${slideText.title}"`;

  try {
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-pro-image-preview",
        messages: [
          { role: "user", content: prompt }
        ],
        modalities: ["image", "text"]
      })
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    const imageBase64 = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;

    if (imageBase64) {
      // Upload to Cloudinary
      return await uploadToCloudinary(imageBase64, `carousel-pack/${brand.id}/${index}`);
    }
  } catch (error) {
    console.error(`[generate-carousel-pack] Error generating image for slide ${index + 1}:`, error);
  }

  return "/images/carousel-preview.jpg";
}

async function uploadToCloudinary(base64Data: string, publicId: string): Promise<string> {
  const cloudName = Deno.env.get("CLOUDINARY_CLOUD_NAME");
  const apiKey = Deno.env.get("CLOUDINARY_API_KEY");
  const apiSecret = Deno.env.get("CLOUDINARY_API_SECRET");

  if (!cloudName || !apiKey || !apiSecret) {
    return base64Data;
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const paramsToSign = `public_id=${publicId}&timestamp=${timestamp}`;
  
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
    return base64Data;
  }

  const result = await response.json();
  return result.secure_url;
}

function generateCanvaCSV(slides: Array<{ title: string; subtitle: string; body: string }>): string {
  const header = "slide,title,subtitle,body";
  const rows = slides.map((slide, i) => {
    const escapeCsv = (str: string) => `"${str.replace(/"/g, '""')}"`;
    return `${i + 1},${escapeCsv(slide.title)},${escapeCsv(slide.subtitle)},${escapeCsv(slide.body)}`;
  });
  
  return [header, ...rows].join("\n");
}

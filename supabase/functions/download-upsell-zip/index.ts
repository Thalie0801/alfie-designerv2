import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import JSZip from "npm:jszip@3.10.1";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const STRUCTURE_FOLDERS: Record<string, string> = {
  benefit: "01_Benefice",
  proof: "02_Preuve",
  offer: "03_Offre_CTA",
  problem_solution: "04_Probleme_Solution",
  checklist_steps: "05_Checklist",
};

async function fetchImageAsArrayBuffer(url: string): Promise<ArrayBuffer | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    return await response.arrayBuffer();
  } catch (error) {
    console.error("[download-upsell-zip] Error fetching image:", error);
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const { orderId } = await req.json();

    if (!orderId) {
      return new Response(
        JSON.stringify({ success: false, error: "orderId required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[download-upsell-zip] Creating ZIP for order:", orderId);

    // Get order and verify ownership
    const authHeader = req.headers.get("Authorization");
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const { data: { user } } = await supabase.auth.getUser(token);
      
      if (user) {
        const { data: order } = await supabase
          .from("upsell_orders")
          .select("id, user_id, status, zip_url")
          .eq("id", orderId)
          .eq("user_id", user.id)
          .single();

        if (!order) {
          return new Response(
            JSON.stringify({ success: false, error: "Order not found" }),
            { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Return cached ZIP if available
        if (order.zip_url) {
          console.log("[download-upsell-zip] Returning cached ZIP");
          return new Response(
            JSON.stringify({ success: true, zipUrl: order.zip_url }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }
    }

    // Fetch all assets for this order
    const { data: assets, error: assetsError } = await supabase
      .from("upsell_assets")
      .select("*")
      .eq("upsell_order_id", orderId)
      .order("structure")
      .order("variation_index");

    if (assetsError || !assets || assets.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: "No assets found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[download-upsell-zip] Found", assets.length, "assets");

    // Create ZIP
    const zip = new JSZip();

    // Add README
    zip.file("README.txt", `Pack 30 Visuels Alfie
========================

Ce pack contient 30 visuels réutilisables organisés par structure marketing:

📁 01_Benefice (6 visuels)
   → Montrez les résultats et transformations

📁 02_Preuve (6 visuels)  
   → Renforcez la confiance et crédibilité

📁 03_Offre_CTA (6 visuels)
   → Présentez vos offres avec impact

📁 04_Probleme_Solution (6 visuels)
   → Illustrez le passage avant/après

📁 05_Checklist (6 visuels)
   → Montrez vos processus et méthodes

Comment utiliser ces visuels:
1. Importez-les dans Canva
2. Ajoutez votre texte par-dessus
3. Exportez et publiez !

Besoin d'aide ? Contactez-nous sur alfie.design

© ${new Date().getFullYear()} Alfie Designer
`);

    // Download and add each image
    for (const asset of assets) {
      if (!asset.cloudinary_url) continue;

      const folderName = STRUCTURE_FOLDERS[asset.structure] || asset.structure;
      const fileName = `${asset.structure}_v${asset.variation_index}.png`;
      const filePath = `${folderName}/${fileName}`;

      try {
        const imageData = await fetchImageAsArrayBuffer(asset.cloudinary_url);
        if (imageData) {
          zip.file(filePath, imageData);
          console.log("[download-upsell-zip] Added:", filePath);
        }
      } catch (error) {
        console.error("[download-upsell-zip] Error adding image:", filePath, error);
      }
    }

    // Generate ZIP blob
    const zipBlob = await zip.generateAsync({ 
      type: "arraybuffer",
      compression: "DEFLATE",
      compressionOptions: { level: 6 },
    });

    // Upload ZIP to Cloudinary
    const cloudName = Deno.env.get("CLOUDINARY_CLOUD_NAME");
    const apiKey = Deno.env.get("CLOUDINARY_API_KEY");
    const apiSecret = Deno.env.get("CLOUDINARY_API_SECRET");

    let zipUrl = "";

    if (cloudName && apiKey && apiSecret) {
      const timestamp = Math.floor(Date.now() / 1000);
      const publicId = `alfie-pack-${orderId}`;
      const signatureString = `folder=alfie-zips&public_id=${publicId}&resource_type=raw&timestamp=${timestamp}${apiSecret}`;
      
      const encoder = new TextEncoder();
      const data = encoder.encode(signatureString);
      const hashBuffer = await crypto.subtle.digest("SHA-1", data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const signature = hashArray.map(b => b.toString(16).padStart(2, "0")).join("");

      // Convert ArrayBuffer to base64
      const base64 = btoa(
        new Uint8Array(zipBlob).reduce((data, byte) => data + String.fromCharCode(byte), "")
      );

      const formData = new FormData();
      formData.append("file", `data:application/zip;base64,${base64}`);
      formData.append("api_key", apiKey);
      formData.append("timestamp", timestamp.toString());
      formData.append("signature", signature);
      formData.append("public_id", publicId);
      formData.append("folder", "alfie-zips");
      formData.append("resource_type", "raw");

      const uploadResponse = await fetch(
        `https://api.cloudinary.com/v1_1/${cloudName}/raw/upload`,
        { method: "POST", body: formData }
      );

      if (uploadResponse.ok) {
        const uploadResult = await uploadResponse.json();
        zipUrl = uploadResult.secure_url;
        
        // Cache ZIP URL
        await supabase
          .from("upsell_orders")
          .update({ zip_url: zipUrl })
          .eq("id", orderId);
      }
    }

    // Fallback: return inline download if Cloudinary fails
    if (!zipUrl) {
      // Return the ZIP as a downloadable response
      return new Response(zipBlob, {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/zip",
          "Content-Disposition": `attachment; filename="alfie-pack-${orderId}.zip"`,
        },
      });
    }

    console.log("[download-upsell-zip] ZIP created:", zipUrl);

    return new Response(
      JSON.stringify({ success: true, zipUrl }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[download-upsell-zip] Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

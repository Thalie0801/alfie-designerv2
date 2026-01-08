import { corsHeaders } from "../_shared/cors.ts";

interface PackEmailRequest {
  email: string;
  packType: "free" | "carousel";
  brandName: string;
  assets?: Array<{ title: string; ratio: string; url: string }>;
  carouselId?: string;
  slides?: Array<{ title: string; subtitle: string; body: string; imageUrl: string }>;
  csvContent?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { email, packType, brandName, assets, carouselId, slides, csvContent } = await req.json() as PackEmailRequest;

    console.log("[send-pack-email] Sending email", { email, packType, brandName });

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      throw new Error("RESEND_API_KEY not configured");
    }

    const frontendUrl = Deno.env.get("FRONTEND_URL") || "https://alfie-designer.com";
    
    let subject: string;
    let html: string;

    if (packType === "free") {
      subject = `🎉 Ton pack gratuit pour ${brandName} est prêt !`;
      html = getFreePackEmailHtml(brandName, assets || [], frontendUrl);
    } else {
      subject = `🚀 Ton carrousel 10 slides pour ${brandName} est prêt !`;
      html = getCarouselPackEmailHtml(brandName, slides || [], csvContent || "", frontendUrl, carouselId || "");
    }

    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify({
        from: "Alfie Designer <onboarding@resend.dev>",
        to: [email],
        subject,
        html,
      }),
    });

    if (!emailResponse.ok) {
      const error = await emailResponse.text();
      throw new Error(`Resend API error: ${error}`);
    }

    const data = await emailResponse.json();
    console.log("[send-pack-email] Email sent successfully:", data);

    return new Response(
      JSON.stringify({ success: true }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("[send-pack-email] Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

function getFreePackEmailHtml(brandName: string, assets: Array<{ title: string; ratio: string; url: string }>, frontendUrl: string): string {
  const assetsList = assets.map(asset => `
    <tr>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">
        <strong>${asset.title}</strong>
        <br><span style="color: #6b7280; font-size: 14px;">${asset.ratio}</span>
      </td>
    </tr>
  `).join("");

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #96E6A1 0%, #D4A5FF 100%); padding: 40px 20px; text-align: center; border-radius: 16px 16px 0 0; }
    .header h1 { color: #1a1a1a; margin: 0; font-size: 24px; }
    .content { background: #ffffff; padding: 32px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 16px 16px; }
    .button { display: inline-block; padding: 14px 32px; background: #96E6A1; color: #1a1a1a !important; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 20px 0; }
    .button:hover { background: #FFB5BA; }
    .assets-table { width: 100%; border-collapse: collapse; margin: 20px 0; background: #f9fafb; border-radius: 8px; overflow: hidden; }
    .footer { text-align: center; color: #6b7280; font-size: 14px; margin-top: 24px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>🎨 Ton pack gratuit est prêt !</h1>
  </div>
  <div class="content">
    <p>Hello ! 👋</p>
    
    <p>Super nouvelle ! Tes 3 visuels personnalisés pour <strong>${brandName}</strong> sont prêts.</p>
    
    <table class="assets-table">
      ${assetsList}
    </table>
    
    <div style="text-align: center;">
      <a href="${frontendUrl}/free-pack" class="button">
        📥 Télécharger mon pack
      </a>
    </div>
    
    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 32px 0;">
    
    <div style="background: linear-gradient(135deg, #96E6A1 0%, #D4A5FF 100%); padding: 24px; border-radius: 12px; text-align: center;">
      <h3 style="margin: 0 0 12px 0; color: #1a1a1a;">🚀 Envie d'aller plus loin ?</h3>
      <p style="margin: 0 0 16px 0; color: #374151;">Obtiens un carrousel complet de 10 slides + export CSV Canva pour seulement 19€</p>
      <a href="${frontendUrl}/checkout/express?product=carousel10" style="display: inline-block; padding: 12px 24px; background: #1a1a1a; color: white !important; text-decoration: none; border-radius: 8px; font-weight: 600;">
        Découvrir l'offre →
      </a>
    </div>
    
    <p style="margin-top: 24px;">À très vite ! 🐕</p>
    <p><strong>Alfie</strong></p>
  </div>
  <div class="footer">
    <p>© ${new Date().getFullYear()} Alfie Designer</p>
  </div>
</body>
</html>`;
}

function getCarouselPackEmailHtml(
  brandName: string, 
  slides: Array<{ title: string; subtitle: string; body: string }>, 
  csvContent: string, 
  frontendUrl: string,
  carouselId: string
): string {
  const slidesList = slides.slice(0, 3).map((slide, i) => `
    <tr>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">
        <strong>Slide ${i + 1}:</strong> ${slide.title}
      </td>
    </tr>
  `).join("");

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #FFB5BA 0%, #D4A5FF 100%); padding: 40px 20px; text-align: center; border-radius: 16px 16px 0 0; }
    .header h1 { color: #1a1a1a; margin: 0; font-size: 24px; }
    .content { background: #ffffff; padding: 32px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 16px 16px; }
    .button { display: inline-block; padding: 14px 32px; background: #96E6A1; color: #1a1a1a !important; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 10px 5px; }
    .slides-table { width: 100%; border-collapse: collapse; margin: 20px 0; background: #f9fafb; border-radius: 8px; overflow: hidden; }
    .footer { text-align: center; color: #6b7280; font-size: 14px; margin-top: 24px; }
    .feature { display: inline-block; margin: 8px; padding: 8px 16px; background: #f3f4f6; border-radius: 20px; font-size: 14px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>🚀 Ton carrousel est prêt !</h1>
  </div>
  <div class="content">
    <p>Hello ! 👋</p>
    
    <p>Félicitations ! Ton carrousel de <strong>10 slides</strong> pour <strong>${brandName}</strong> est prêt à être téléchargé.</p>
    
    <div style="text-align: center; margin: 24px 0;">
      <span class="feature">✅ 10 slides HD</span>
      <span class="feature">✅ Textes générés par IA</span>
      <span class="feature">✅ CSV Canva inclus</span>
    </div>
    
    <h3>Aperçu des slides :</h3>
    <table class="slides-table">
      ${slidesList}
      <tr>
        <td style="padding: 12px; color: #6b7280;">+ 7 autres slides...</td>
      </tr>
    </table>
    
    <div style="text-align: center;">
      <a href="${frontendUrl}/library?carousel=${carouselId}" class="button">
        📥 Télécharger les images
      </a>
      <a href="${frontendUrl}/library?carousel=${carouselId}&csv=true" class="button" style="background: #FFB5BA;">
        📊 Télécharger le CSV Canva
      </a>
    </div>
    
    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 32px 0;">
    
    <h3>Comment utiliser ton CSV dans Canva ?</h3>
    <ol style="color: #374151;">
      <li>Ouvre Canva et crée un design "Carrousel Instagram"</li>
      <li>Va dans "Applications" → "Bulk Create"</li>
      <li>Importe ton fichier CSV</li>
      <li>Lie les champs aux éléments texte de ton design</li>
      <li>Génère tes 10 slides en un clic !</li>
    </ol>
    
    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 32px 0;">
    
    <div style="background: #f9fafb; padding: 24px; border-radius: 12px; text-align: center;">
      <h3 style="margin: 0 0 12px 0;">💡 Envie de créer sans limites ?</h3>
      <p style="margin: 0 0 16px 0; color: #374151;">Passe à l'abonnement et génère autant de visuels que tu veux.</p>
      <a href="${frontendUrl}/billing" style="display: inline-block; padding: 12px 24px; background: #1a1a1a; color: white !important; text-decoration: none; border-radius: 8px; font-weight: 600;">
        Voir les abonnements →
      </a>
    </div>
    
    <p style="margin-top: 24px;">Merci pour ta confiance ! 🐕</p>
    <p><strong>Alfie</strong></p>
  </div>
  <div class="footer">
    <p>© ${new Date().getFullYear()} Alfie Designer</p>
  </div>
</body>
</html>`;
}

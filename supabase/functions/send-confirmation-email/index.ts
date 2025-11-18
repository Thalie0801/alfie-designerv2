import { corsHeaders } from "../_shared/cors.ts";
const PLAN_NAMES = {
  starter: "Starter",
  pro: "Pro",
  studio: "Studio",
  enterprise: "Enterprise",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { email, plan } = await req.json();

    if (!email || !plan) {
      throw new Error("Email and plan are required");
    }

    const planName = PLAN_NAMES[plan as keyof typeof PLAN_NAMES] || plan;

    // Use fetch to call Resend API directly
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      throw new Error("RESEND_API_KEY not configured");
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
        subject: `Bienvenue dans Alfie ${planName} ! 🎉`,
        html: getEmailHtml(planName, plan),
      }),
    });

    if (!emailResponse.ok) {
      const error = await emailResponse.text();
      throw new Error(`Resend API error: ${error}`);
    }

    const data = await emailResponse.json();
    console.log("Email sent successfully:", data);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error in send-confirmation-email:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});

function getEmailHtml(planName: string, plan: string): string {
  const baseUrl = Deno.env.get("SUPABASE_URL")?.replace("supabase.co", "lovable.app") || "";
  
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
    }
    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      padding: 40px 20px;
      text-align: center;
      border-radius: 10px 10px 0 0;
    }
    .header h1 {
      color: white;
      margin: 0;
      font-size: 28px;
    }
    .content {
      background: #ffffff;
      padding: 40px 30px;
      border: 1px solid #e5e7eb;
      border-top: none;
    }
    .button {
      display: inline-block;
      padding: 14px 32px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white !important;
      text-decoration: none;
      border-radius: 8px;
      font-weight: 600;
      margin: 20px 0;
    }
    .features {
      background: #f9fafb;
      padding: 20px;
      border-radius: 8px;
      margin: 20px 0;
    }
    .feature-item {
      padding: 8px 0;
      display: flex;
      align-items: center;
    }
    .checkmark {
      color: #10b981;
      margin-right: 10px;
      font-weight: bold;
    }
    .footer {
      text-align: center;
      color: #6b7280;
      font-size: 14px;
      margin-top: 30px;
      padding-top: 20px;
      border-top: 1px solid #e5e7eb;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>✨ Bienvenue dans Alfie ${planName} !</h1>
  </div>
  <div class="content">
    <p>Bonjour,</p>
    
    <p>Merci d'avoir rejoint <strong>Alfie Designer</strong> ! Votre abonnement <strong>${planName}</strong> est maintenant actif.</p>
    
    <div class="features">
      <h3 style="margin-top: 0;">Vos avantages :</h3>
      ${getPlanFeatures(plan)}
    </div>
    
    <p>Vous pouvez dès maintenant vous connecter et commencer à créer vos visuels :</p>
    
    <div style="text-align: center;">
      <a href="${baseUrl}/auth" class="button">
        Commencer maintenant →
      </a>
    </div>
    
    <p style="margin-top: 30px;">Si vous avez des questions, n'hésitez pas à nous contacter.</p>
    
    <p>À très bientôt,<br>
    <strong>L'équipe Alfie Designer</strong></p>
  </div>
  <div class="footer">
    <p>© ${new Date().getFullYear()} Alfie Designer. Tous droits réservés.</p>
  </div>
</body>
</html>`;
}

function getPlanFeatures(plan: string): string {
  const features = {
    starter: [
      "1 marque",
      "20 visuels par mois",
      "2 templates",
      "Support email",
    ],
    pro: [
      "3 marques",
      "100 visuels par mois",
      "4 templates + Reels simples",
      "Support prioritaire",
    ],
    studio: [
      "Multi-marques (5 marques)",
      "1000 visuels par mois",
      "Reels avancés",
      "Analytics détaillées",
    ],
    enterprise: [
      "Illimité",
      "API & SSO",
      "White-label",
      "Support dédié",
    ],
  };

  const planFeatures = features[plan as keyof typeof features] || [];
  
  return planFeatures
    .map((feature) => `
      <div class="feature-item">
        <span class="checkmark">✓</span>
        <span>${feature}</span>
      </div>
    `)
    .join("");
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BREVO_API_URL = "https://api.brevo.com/v3";

function getApiKey(): string {
  const apiKey = Deno.env.get("BREVO_API_KEY");
  if (!apiKey) {
    throw new Error("BREVO_API_KEY is not configured");
  }
  return apiKey;
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email } = await req.json();

    if (!email) {
      return new Response(
        JSON.stringify({ error: "Email address is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[test-email] Sending test email to: ${email}`);

    const emailBody = {
      to: [{ email, name: "Test User" }],
      sender: { name: "Alfie Designer", email: "noreply@alfie-designer.com" },
      subject: "🧪 Test Brevo - Alfie Designer",
      htmlContent: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #8B5CF6;">✅ Email de test reçu !</h1>
          <p>Cet email confirme que la configuration Brevo fonctionne correctement.</p>
          <p><strong>Envoyé à:</strong> ${email}</p>
          <p><strong>Date:</strong> ${new Date().toISOString()}</p>
          <hr style="border: 1px solid #eee; margin: 20px 0;">
          <p style="color: #666; font-size: 12px;">Alfie Designer - noreply@alfie-designer.com</p>
        </div>
      `,
    };

    const startTime = Date.now();
    const response = await fetch(`${BREVO_API_URL}/smtp/email`, {
      method: "POST",
      headers: {
        "api-key": getApiKey(),
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(emailBody),
    });

    const duration = Date.now() - startTime;
    const responseText = await response.text();

    console.log(`[test-email] Brevo response (${duration}ms):`, {
      status: response.status,
      statusText: response.statusText,
      body: responseText,
    });

    if (!response.ok) {
      console.error(`[test-email] Brevo API error:`, responseText);
      return new Response(
        JSON.stringify({
          success: false,
          error: `Brevo API error (${response.status})`,
          details: responseText,
          duration,
        }),
        { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let result;
    try {
      result = JSON.parse(responseText);
    } catch {
      result = { raw: responseText };
    }

    console.log(`[test-email] ✅ Email sent successfully:`, {
      messageId: result.messageId,
      to: email,
      duration,
    });

    return new Response(
      JSON.stringify({
        success: true,
        messageId: result.messageId,
        to: email,
        duration,
        message: "Email envoyé avec succès ! Vérifie ta boîte de réception (et spam).",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("[test-email] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

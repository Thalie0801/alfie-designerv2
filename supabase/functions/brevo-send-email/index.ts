

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BREVO_API_URL = "https://api.brevo.com/v3";

interface EmailRecipient {
  email: string;
  name?: string;
}

interface SendEmailRequest {
  to: EmailRecipient[];
  subject?: string;
  htmlContent?: string;
  textContent?: string;
  templateId?: number;
  params?: Record<string, unknown>;
  sender?: { name: string; email: string };
  replyTo?: EmailRecipient;
  tags?: string[];
  cc?: EmailRecipient[];
  bcc?: EmailRecipient[];
}

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
    const body: SendEmailRequest = await req.json();
    const {
      to,
      subject,
      htmlContent,
      textContent,
      templateId,
      params,
      sender,
      replyTo,
      tags,
      cc,
      bcc,
    } = body;

    // Validation
    if (!to || to.length === 0) {
      return new Response(
        JSON.stringify({ error: "At least one recipient is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!templateId && !subject) {
      return new Response(
        JSON.stringify({ error: "Either templateId or subject is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[brevo-send-email] Sending email:", {
      to: to.map(r => r.email),
      subject: subject || `templateId:${templateId}`,
      sender: sender?.email || "noreply@alfiedesigner.com",
    });

    // Build request body
    const emailBody: Record<string, unknown> = {
      to,
      sender: sender || { name: "Alfie", email: "noreply@alfiedesigner.com" },
    };

    if (templateId) {
      emailBody.templateId = templateId;
    } else {
      emailBody.subject = subject;
      if (htmlContent) emailBody.htmlContent = htmlContent;
      if (textContent) emailBody.textContent = textContent;
    }

    if (params) emailBody.params = params;
    if (replyTo) emailBody.replyTo = replyTo;
    if (tags) emailBody.tags = tags;
    if (cc && cc.length > 0) emailBody.cc = cc;
    if (bcc && bcc.length > 0) emailBody.bcc = bcc;

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
    console.log(`[brevo-send-email] Brevo API response (${duration}ms):`, {
      status: response.status,
      statusText: response.statusText,
      body: responseText.substring(0, 500),
    });

    if (!response.ok) {
      console.error("[brevo-send-email] ❌ Failed:", {
        status: response.status,
        error: responseText,
        recipients: to.map(r => r.email),
      });
      return new Response(
        JSON.stringify({ error: `Brevo API error: ${responseText}` }),
        { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let result;
    try {
      result = JSON.parse(responseText);
    } catch {
      result = { raw: responseText };
    }

    console.log("[brevo-send-email] ✅ Success:", {
      messageId: result.messageId,
      recipients: to.map(r => r.email),
      duration,
    });

    return new Response(
      JSON.stringify({
        success: true,
        messageId: result.messageId,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: unknown) {
    console.error("[brevo-send-email] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

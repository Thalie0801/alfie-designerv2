import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@4.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PasswordResetRequest {
  email: string;
  resetLink: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, resetLink }: PasswordResetRequest = await req.json();

    console.log(`[send-password-reset] Sending email to ${email}`);

    const emailResponse = await resend.emails.send({
      from: "Alfie <onboarding@resend.dev>",
      to: [email],
      subject: "Réinitialisation de votre mot de passe Alfie",
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { text-align: center; margin-bottom: 30px; }
              .content { background: #f9f9f9; padding: 30px; border-radius: 10px; }
              .button { display: inline-block; padding: 12px 24px; background: #8B5CF6; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0; }
              .footer { text-align: center; margin-top: 30px; font-size: 12px; color: #999; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1 style="color: #8B5CF6;">🐾 Alfie</h1>
              </div>
              <div class="content">
                <h2>Réinitialisation de mot de passe</h2>
                <p>Bonjour,</p>
                <p>Vous avez demandé à réinitialiser votre mot de passe sur Alfie.</p>
                <p>Cliquez sur le bouton ci-dessous pour définir un nouveau mot de passe :</p>
                <div style="text-align: center;">
                  <a href="${resetLink}" class="button">Réinitialiser mon mot de passe</a>
                </div>
                <p style="font-size: 14px; color: #666;">
                  Ce lien est valable pendant 1 heure. Si vous n'avez pas demandé cette réinitialisation, vous pouvez ignorer cet email en toute sécurité.
                </p>
              </div>
              <div class="footer">
                <p>Alfie - Votre assistant créatif IA</p>
              </div>
            </div>
          </body>
        </html>
      `,
    });

    if (emailResponse.error) {
      console.error("[send-password-reset] Error:", emailResponse.error);
      throw emailResponse.error;
    }

    console.log("[send-password-reset] Email sent successfully:", emailResponse.data?.id);

    return new Response(JSON.stringify({ success: true, id: emailResponse.data?.id }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("[send-password-reset] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Erreur lors de l'envoi de l'email" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);

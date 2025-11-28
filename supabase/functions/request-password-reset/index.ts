import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { Resend } from "https://esm.sh/resend@4.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PasswordResetRequest {
  email: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email }: PasswordResetRequest = await req.json();

    if (!email) {
      throw new Error("Email requis");
    }

    console.log(`[request-password-reset] Processing reset for ${email}`);

    // Créer client admin Supabase
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Générer un lien de récupération sécurisé via Supabase Admin
    const { data, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'recovery',
      email,
      options: {
        redirectTo: `${new URL(req.url).origin}/reset-password`
      }
    });

    if (linkError) {
      console.error("[request-password-reset] Link generation error:", linkError);
      throw new Error("Erreur lors de la génération du lien");
    }

    if (!data?.properties?.action_link) {
      throw new Error("Lien de réinitialisation non généré");
    }

    const resetLink = data.properties.action_link;

    console.log(`[request-password-reset] Sending email to ${email}`);

    // Envoyer l'email avec template Alfie en français
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
      console.error("[request-password-reset] Email error:", emailResponse.error);
      throw emailResponse.error;
    }

    console.log("[request-password-reset] Email sent successfully:", emailResponse.data?.id);

    return new Response(JSON.stringify({ success: true, id: emailResponse.data?.id }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("[request-password-reset] Error:", error);
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

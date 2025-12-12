import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BATCH_SIZE = 20;

interface EmailQueueItem {
  id: string;
  to_email: string;
  template: string;
  payload: Record<string, unknown>;
  attempts: number;
}

const EMAIL_TEMPLATES: Record<string, { subject: string; getHtml: (payload: Record<string, unknown>) => string }> = {
  start: {
    subject: "🚀 Je lance ton pack !",
    getHtml: (payload) => `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f9fafb; padding: 40px 20px;">
          <div style="max-width: 480px; margin: 0 auto; background: white; border-radius: 16px; padding: 32px; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
            <div style="text-align: center; margin-bottom: 24px;">
              <span style="font-size: 48px;">🎮</span>
            </div>
            <h1 style="color: #1f2937; font-size: 24px; text-align: center; margin-bottom: 16px;">
              Partie sauvegardée !
            </h1>
            <p style="color: #6b7280; font-size: 16px; line-height: 1.6; text-align: center; margin-bottom: 24px;">
              Alfie prépare ton pack de visuels. Tu recevras un email dès qu'il sera prêt !
            </p>
            <div style="background: linear-gradient(135deg, #fef3c7, #fde68a); border-radius: 12px; padding: 20px; text-align: center;">
              <p style="color: #92400e; font-size: 14px; margin: 0;">
                ⚡ Temps estimé : quelques minutes
              </p>
            </div>
            <p style="color: #9ca3af; font-size: 12px; text-align: center; margin-top: 32px;">
              Alfie Designer • Tes visuels, en un clic
            </p>
          </div>
        </body>
      </html>
    `,
  },
  delivery_ready: {
    subject: "🎁 Ton pack est prêt !",
    getHtml: (payload) => `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f9fafb; padding: 40px 20px;">
          <div style="max-width: 480px; margin: 0 auto; background: white; border-radius: 16px; padding: 32px; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
            <div style="text-align: center; margin-bottom: 24px;">
              <span style="font-size: 48px;">🎁</span>
            </div>
            <h1 style="color: #1f2937; font-size: 24px; text-align: center; margin-bottom: 16px;">
              Ton pack est prêt !
            </h1>
            <p style="color: #6b7280; font-size: 16px; line-height: 1.6; text-align: center; margin-bottom: 24px;">
              Alfie a terminé de créer tes visuels. Récupère-les maintenant !
            </p>
            ${payload.canva_url ? `
              <a href="${payload.canva_url}" style="display: block; background: linear-gradient(135deg, #8b5cf6, #7c3aed); color: white; text-decoration: none; padding: 16px 24px; border-radius: 12px; text-align: center; font-weight: 600; margin-bottom: 12px;">
                🎨 Ouvrir dans Canva
              </a>
            ` : ''}
            ${payload.zip_url ? `
              <a href="${payload.zip_url}" style="display: block; background: linear-gradient(135deg, #10b981, #059669); color: white; text-decoration: none; padding: 16px 24px; border-radius: 12px; text-align: center; font-weight: 600;">
                📥 Télécharger le ZIP
              </a>
            ` : ''}
            <p style="color: #9ca3af; font-size: 12px; text-align: center; margin-top: 32px;">
              Alfie Designer • Tes visuels, en un clic
            </p>
          </div>
        </body>
      </html>
    `,
  },
  reminder_2h: {
    subject: "⏰ Ton pack t'attend !",
    getHtml: (payload) => `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f9fafb; padding: 40px 20px;">
          <div style="max-width: 480px; margin: 0 auto; background: white; border-radius: 16px; padding: 32px; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
            <div style="text-align: center; margin-bottom: 24px;">
              <span style="font-size: 48px;">⏰</span>
            </div>
            <h1 style="color: #1f2937; font-size: 24px; text-align: center; margin-bottom: 16px;">
              Ton pack t'attend !
            </h1>
            <p style="color: #6b7280; font-size: 16px; line-height: 1.6; text-align: center; margin-bottom: 24px;">
              Tu n'as pas encore récupéré ton pack de visuels. Il est prêt et n'attend que toi !
            </p>
            <a href="https://alfie.design/start" style="display: block; background: linear-gradient(135deg, #f59e0b, #d97706); color: white; text-decoration: none; padding: 16px 24px; border-radius: 12px; text-align: center; font-weight: 600;">
              🎮 Récupérer mon pack
            </a>
            <p style="color: #9ca3af; font-size: 12px; text-align: center; margin-top: 32px;">
              Alfie Designer • Tes visuels, en un clic
            </p>
          </div>
        </body>
      </html>
    `,
  },
  reminder_24h: {
    subject: "💡 Tips pour utiliser ton pack + offre spéciale",
    getHtml: (payload) => `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f9fafb; padding: 40px 20px;">
          <div style="max-width: 480px; margin: 0 auto; background: white; border-radius: 16px; padding: 32px; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
            <div style="text-align: center; margin-bottom: 24px;">
              <span style="font-size: 48px;">💡</span>
            </div>
            <h1 style="color: #1f2937; font-size: 24px; text-align: center; margin-bottom: 16px;">
              Comment utiliser ton pack ?
            </h1>
            <div style="background: #f3f4f6; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
              <p style="color: #374151; font-size: 14px; margin: 0 0 12px 0;">✅ <strong>Télécharge le ZIP</strong> avec tes visuels HD</p>
              <p style="color: #374151; font-size: 14px; margin: 0 0 12px 0;">✅ <strong>Ouvre dans Canva</strong> pour personnaliser</p>
              <p style="color: #374151; font-size: 14px; margin: 0;">✅ <strong>Publie</strong> sur Instagram, LinkedIn, TikTok...</p>
            </div>
            <div style="background: linear-gradient(135deg, #fef3c7, #fde68a); border-radius: 12px; padding: 20px; text-align: center; margin-bottom: 24px;">
              <p style="color: #92400e; font-size: 16px; font-weight: 600; margin: 0 0 8px 0;">
                🎉 Offre spéciale -20%
              </p>
              <p style="color: #a16207; font-size: 14px; margin: 0;">
                Upgrade vers Pro pour des packs illimités
              </p>
            </div>
            <a href="https://alfie.design/billing" style="display: block; background: linear-gradient(135deg, #8b5cf6, #7c3aed); color: white; text-decoration: none; padding: 16px 24px; border-radius: 12px; text-align: center; font-weight: 600;">
              🚀 Découvrir les offres
            </a>
            <p style="color: #9ca3af; font-size: 12px; text-align: center; margin-top: 32px;">
              Alfie Designer • Tes visuels, en un clic
            </p>
          </div>
        </body>
      </html>
    `,
  },
};

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      throw new Error("RESEND_API_KEY not configured");
    }

    const resend = new Resend(resendApiKey);
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log("[email-worker] Starting batch processing...");

    // Get queued emails ready to send
    const { data: emails, error: fetchError } = await supabase
      .from("email_queue")
      .select("id, to_email, template, payload, attempts")
      .eq("status", "queued")
      .lte("run_after", new Date().toISOString())
      .order("created_at", { ascending: true })
      .limit(BATCH_SIZE);

    if (fetchError) {
      throw fetchError;
    }

    if (!emails || emails.length === 0) {
      console.log("[email-worker] No emails to process");
      return new Response(
        JSON.stringify({ processed: 0, message: "No emails to process" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[email-worker] Processing ${emails.length} emails...`);

    let successCount = 0;
    let failCount = 0;

    for (const email of emails as EmailQueueItem[]) {
      try {
        const template = EMAIL_TEMPLATES[email.template];
        if (!template) {
          throw new Error(`Unknown template: ${email.template}`);
        }

        const { error: sendError } = await resend.emails.send({
          from: "Alfie Designer <noreply@alfie.design>",
          to: [email.to_email],
          subject: template.subject,
          html: template.getHtml(email.payload),
        });

        if (sendError) {
          throw sendError;
        }

        // Mark as sent
        await supabase
          .from("email_queue")
          .update({
            status: "sent",
            sent_at: new Date().toISOString(),
          })
          .eq("id", email.id);

        successCount++;
        console.log(`[email-worker] Sent ${email.template} to ${email.to_email}`);
      } catch (sendErr: unknown) {
        console.error(`[email-worker] Failed to send to ${email.to_email}:`, sendErr);
        
        const newAttempts = email.attempts + 1;
        const newStatus = newAttempts >= 3 ? "failed" : "queued";
        const errorMessage = sendErr instanceof Error ? sendErr.message : "Unknown error";
        
        await supabase
          .from("email_queue")
          .update({
            status: newStatus,
            attempts: newAttempts,
            last_error: errorMessage,
            run_after: newStatus === "queued" 
              ? new Date(Date.now() + 5 * 60 * 1000).toISOString()
              : undefined,
          })
          .eq("id", email.id);

        failCount++;
      }
    }

    console.log(`[email-worker] Completed: ${successCount} sent, ${failCount} failed`);

    return new Response(
      JSON.stringify({
        processed: emails.length,
        sent: successCount,
        failed: failCount,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("[email-worker] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

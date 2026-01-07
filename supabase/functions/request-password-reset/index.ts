import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { Resend } from "npm:resend@4";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Rate limiting configuration
const MAX_REQUESTS_PER_HOUR = 3;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PasswordResetRequest {
  email: string;
  appOrigin: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, appOrigin }: PasswordResetRequest = await req.json();

    if (!email) {
      throw new Error("Email requis");
    }

    // Normalize email
    const normalizedEmail = email.toLowerCase().trim();
    
    // Get client IP for logging
    const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || 
                     req.headers.get("cf-connecting-ip") || 
                     "unknown";

    console.log(`[request-password-reset] Processing reset for ${normalizedEmail} from ${clientIp}`);

    // Create admin Supabase client
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // === RATE LIMITING ===
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    
    // Count recent requests for this email
    const { count, error: countError } = await supabaseAdmin
      .from('password_reset_requests')
      .select('*', { count: 'exact', head: true })
      .eq('email', normalizedEmail)
      .gte('created_at', oneHourAgo);

    if (countError) {
      console.error("[request-password-reset] Rate limit check error:", countError);
      // Continue anyway - don't block legitimate requests due to DB errors
    }

    const requestCount = count || 0;
    console.log(`[request-password-reset] Recent requests for ${normalizedEmail}: ${requestCount}/${MAX_REQUESTS_PER_HOUR}`);

    if (requestCount >= MAX_REQUESTS_PER_HOUR) {
      console.warn(`[request-password-reset] Rate limit exceeded for ${normalizedEmail}`);
      // Return success to prevent email enumeration, but don't actually send
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Log this request for rate limiting
    await supabaseAdmin.from('password_reset_requests').insert({
      email: normalizedEmail,
      ip_address: clientIp
    });

    // Cleanup old requests (older than 24h) - fire and forget
    (async () => {
      try {
        await supabaseAdmin.rpc('cleanup_old_password_reset_requests');
        console.log("[request-password-reset] Cleanup completed");
      } catch (err: unknown) {
        console.warn("[request-password-reset] Cleanup failed:", err);
      }
    })();

    // === GENERATE RESET LINK ===
    const { data, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'recovery',
      email: normalizedEmail,
      options: {
        redirectTo: `${appOrigin}/reset-password`
      }
    });

    if (linkError) {
      console.error("[request-password-reset] Link generation error:", linkError);
      // Return success to prevent email enumeration
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    if (!data?.properties?.action_link) {
      console.error("[request-password-reset] No action link generated");
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Extract token from Supabase-generated link
    const actionLink = data.properties.action_link;
    const actionUrl = new URL(actionLink);
    const token = actionUrl.searchParams.get('token');
    const type = actionUrl.searchParams.get('type');

    if (!token || !type) {
      console.error("[request-password-reset] Missing token or type");
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Build safe intermediate link (anti-preload)
    const resetLink = `${appOrigin}/verify-reset?token=${encodeURIComponent(token)}&type=${encodeURIComponent(type)}`;

    console.log(`[request-password-reset] Sending email to ${normalizedEmail}`);

    // === SEND EMAIL ===
    const emailResponse = await resend.emails.send({
      from: "Alfie <onboarding@resend.dev>",
      to: [normalizedEmail],
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
      // Still return success to prevent enumeration
    } else {
      console.log("[request-password-reset] Email sent successfully:", emailResponse.data?.id);
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("[request-password-reset] Error:", error);
    // Return success even on error to prevent email enumeration
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
};

serve(handler);

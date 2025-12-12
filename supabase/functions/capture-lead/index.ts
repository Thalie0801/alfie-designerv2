import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CaptureLeadRequest {
  email: string;
  intent?: Record<string, unknown>;
  marketingOptIn?: boolean;
  source?: string;
}

serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body: CaptureLeadRequest = await req.json();
    const { email, intent = {}, marketingOptIn = false, source = "start_game" } = body;

    // Validate email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
      return new Response(
        JSON.stringify({ error: "Invalid email address" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const normalizedEmail = email.trim().toLowerCase();

    console.log("[capture-lead] Processing:", { email: normalizedEmail, source });

    // Upsert lead (update if exists, insert if not)
    const { data: lead, error: leadError } = await supabase
      .from("leads")
      .upsert(
        {
          email: normalizedEmail,
          source,
          intent,
          marketing_opt_in: marketingOptIn,
          last_seen_at: new Date().toISOString(),
        },
        {
          onConflict: "email",
          ignoreDuplicates: false,
        }
      )
      .select("id")
      .single();

    if (leadError) {
      console.error("[capture-lead] Lead upsert error:", leadError);
      // Try to get existing lead
      const { data: existingLead } = await supabase
        .from("leads")
        .select("id")
        .eq("email", normalizedEmail)
        .single();
      
      if (existingLead) {
        // Update existing lead
        await supabase
          .from("leads")
          .update({
            intent,
            marketing_opt_in: marketingOptIn,
            last_seen_at: new Date().toISOString(),
          })
          .eq("id", existingLead.id);
      }
    }

    const leadId = lead?.id;

    // Enqueue "start" email (Je lance ton pack)
    const { error: queueError } = await supabase.from("email_queue").insert({
      to_email: normalizedEmail,
      template: "start",
      payload: {
        lead_id: leadId,
        intent,
        source,
      },
      status: "queued",
      run_after: new Date().toISOString(),
    });

    if (queueError) {
      console.error("[capture-lead] Email queue error:", queueError);
    } else {
      console.log("[capture-lead] Email queued for:", normalizedEmail);
    }

    return new Response(
      JSON.stringify({
        success: true,
        lead_id: leadId,
        message: "Lead captured successfully",
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: unknown) {
    console.error("[capture-lead] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

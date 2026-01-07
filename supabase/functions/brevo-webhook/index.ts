import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Brevo event types we care about
const TRACKED_EVENTS = [
  "delivered",
  "soft_bounce",
  "hard_bounce",
  "spam",
  "blocked",
  "invalid_email",
  "opened",
  "click",
  "unsubscribed",
];

interface BrevoWebhookPayload {
  event: string;
  email: string;
  "message-id"?: string;
  ts?: number;
  ts_event?: number;
  tag?: string;
  [key: string]: unknown;
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const payload: BrevoWebhookPayload = await req.json();
    
    console.log("[brevo-webhook] Received event:", {
      event: payload.event,
      email: payload.email,
      messageId: payload["message-id"],
    });

    // Normalize event type
    const eventType = payload.event?.toLowerCase().replace(/ /g, "_") || "unknown";

    if (!TRACKED_EVENTS.includes(eventType)) {
      console.log("[brevo-webhook] Ignoring event type:", eventType);
      return new Response(
        JSON.stringify({ received: true, tracked: false }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const messageId = payload["message-id"];
    const toEmail = payload.email;

    // Find the corresponding email_queue entry by message ID
    let emailQueueId: string | null = null;
    let template: string | null = null;

    if (messageId) {
      const { data: queueItem } = await supabase
        .from("email_queue")
        .select("id, template")
        .eq("provider_message_id", messageId)
        .maybeSingle();

      if (queueItem) {
        emailQueueId = queueItem.id;
        template = queueItem.template;
      }
    }

    // Insert event into email_events
    const { error: insertError } = await supabase.from("email_events").insert({
      email_queue_id: emailQueueId,
      to_email: toEmail,
      template,
      event_type: eventType,
      provider: "brevo",
      provider_message_id: messageId,
      raw_json: payload,
    });

    if (insertError) {
      console.error("[brevo-webhook] Error inserting event:", insertError);
    } else {
      console.log("[brevo-webhook] ✅ Event tracked:", {
        event: eventType,
        email: toEmail,
        messageId,
        emailQueueId,
      });
    }

    // Handle bounces/blocks - could update email_queue status or flag leads
    if (["hard_bounce", "blocked", "invalid_email", "spam"].includes(eventType)) {
      console.warn(`[brevo-webhook] ⚠️ Delivery issue for ${toEmail}: ${eventType}`);
      
      // Could add logic to update leads table or notify admin
      // For now just log it
    }

    return new Response(
      JSON.stringify({ received: true, tracked: true, event: eventType }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("[brevo-webhook] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

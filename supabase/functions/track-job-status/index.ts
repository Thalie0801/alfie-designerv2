import { createClient } from "npm:@supabase/supabase-js@2";

import { corsHeaders } from "../_shared/cors.ts";
import { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, validateEnv } from "../_shared/env.ts";

const envValidation = validateEnv();
if (!envValidation.valid) {
  console.error("Missing required environment variables", { missing: envValidation.missing });
}

interface JobUpdate {
  status: JobStatus;
  progress?: number;
  output_data?: any;
  error?: string;
}

type JobStatus = "pending" | "queued" | "running" | "checking" | "ready" | "failed" | "canceled";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const upgradeHeader = req.headers.get("upgrade") || "";

    if (upgradeHeader.toLowerCase() !== "websocket") {
      return new Response("Expected WebSocket connection", {
        status: 400,
        headers: corsHeaders,
      });
    }

    const { socket, response } = Deno.upgradeWebSocket(req);

    // ✅ Client admin (jobs table)
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    let activeJobId: string | null = null;
    let pollInterval: number | null = null;

    socket.onopen = () => {
      console.log("WebSocket connected");
      socket.send(JSON.stringify({ type: "connected" }));
    };

    socket.onmessage = async (event) => {
      try {
        const message = JSON.parse(event.data);

        if (message.type === "subscribe" && message.jobId) {
          activeJobId = message.jobId;
          console.log(`Subscribed to job: ${activeJobId}`);

          // Clear existing interval
          if (pollInterval) {
            clearInterval(pollInterval);
          }

          // Start polling for job updates
          pollInterval = setInterval(async () => {
            if (!activeJobId) return;

            const { data, error } = await supabase
              .from("job_queue")
              .select("*")
              .eq("id", activeJobId)
              .maybeSingle();

            if (error) {
              console.error("Error fetching job status:", error);
              socket.send(
                JSON.stringify({ type: "error", message: "Failed to fetch job status" }),
              );
              return;
            }

            if (!data) {
              socket.send(JSON.stringify({ type: "job-not-found" }));
              return;
            }

            socket.send(JSON.stringify({ type: "job-update", job: data }));

            if (["ready", "failed", "canceled"].includes(data.status)) {
              if (pollInterval) clearInterval(pollInterval);
            }
          }, 2000);
        }
      } catch (err) {
        console.error("WebSocket message error:", err);
        socket.send(JSON.stringify({ type: "error", message: "Invalid message format" }));
      }
    };

    socket.onclose = () => {
      console.log("WebSocket disconnected");
      if (pollInterval) {
        clearInterval(pollInterval);
      }
    };

    socket.onerror = (err) => {
      console.error("WebSocket error:", err);
      if (pollInterval) {
        clearInterval(pollInterval);
      }
    };

    return response;
  } catch (error: any) {
    console.error("[track-job-status] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal Server Error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

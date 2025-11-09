import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "jsr:@std/http/server";
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors() });
  }
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405, headers: cors() });
  }

  try {
    const supa = createClient(SUPABASE_URL, SERVICE_KEY);

    const { data: jobs, error: selErr } = await supa
      .from("job_queue")
      .select("*")
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(5);

    if (selErr) {
      return json({ ok: false, error: `select:${selErr.message}` }, 400);
    }
    if (!jobs?.length) {
      return json({ ok: true, processed: 0 });
    }

    for (const job of jobs) {
      await supa
        .from("job_queue")
        .update({ status: "processing", started_at: new Date().toISOString() })
        .eq("id", job.id);

      try {
        const asset = {
          url: `https://dummy.assets/asset-${job.id}.png`,
          meta: { from_job: job.id },
        };

        await supa.from("library_assets").insert({
          user_id: job.user_id,
          order_id: job.order_id,
          kind: "image",
          status: "ready",
          url: asset.url,
          meta: asset.meta,
        });

        await supa
          .from("job_queue")
          .update({ status: "done", finished_at: new Date().toISOString() })
          .eq("id", job.id);

        await supa
          .from("orders")
          .update({ status: "done" })
          .eq("id", job.order_id)
          .eq("status", "pending");
      } catch (e) {
        await supa
          .from("job_queue")
          .update({
            status: "error",
            error_message: String(e),
            attempts: (job.attempts ?? 0) + 1,
          })
          .eq("id", job.id);
      }
    }

    return json({ ok: true, processed: jobs.length });
  } catch (e) {
    return json({ ok: false, error: String(e) }, 500);
  }
});

function cors() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };
}

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json", ...cors() },
  });
}

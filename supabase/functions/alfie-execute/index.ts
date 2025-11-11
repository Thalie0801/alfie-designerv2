import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ ok: false, error: "Method Not Allowed" }, 405);

  try {
    const url = must("SUPABASE_URL");
    const service = must("SUPABASE_SERVICE_ROLE_KEY");
    const sb = createClient(url, service);

    const { jobId } = await req.json();
    if (!jobId) throw new Error("Missing jobId");

    const { data: job } = await sb.from("jobs").select("*").eq("id", jobId).single();
    if (!job) throw new Error("Job not found");

    // Marquer running
    await sb.from("jobs").update({ status: "running" }).eq("id", jobId);

    // Log helper
    const log = async (level: "debug" | "info" | "warn" | "error", message: string, meta?: unknown) =>
      sb.from("job_events").insert({ job_id: jobId, level, message, meta });

    // Dispatcher
    switch (job.kind) {
      case "copy":
        await log("info", "Génération du texte…");
        // TODO: appeler LLM, remplir payload.outcome
        break;
      case "vision":
        await log("info", "Génération du brief visuel…");
        // TODO
        break;
      case "render":
        await log("info", "Rendu des visuels…");
        // TODO
        break;
      case "upload":
        await log("info", "Upload Cloudinary…");
        // TODO: upload, insert library_assets
        break;
      case "thumb":
        await log("info", "Génération des miniatures…");
        // TODO
        break;
      case "publish":
        await log("info", "Publication…");
        // TODO
        break;
      default:
        throw new Error(`Unknown job kind: ${job.kind}`);
    }

    await sb.from("jobs").update({ status: "done" }).eq("id", jobId);
    return json({ ok: true });
  } catch (e) {
    return json({ ok: false, error: e instanceof Error ? e.message : String(e) }, 400);
  }
});

function must(k: string) {
  const v = Deno.env.get(k);
  if (!v) throw new Error(`Missing env ${k}`);
  return v;
}

function json(x: unknown, s = 200) {
  return new Response(JSON.stringify(x), {
    status: s,
    headers: { "Content-Type": "application/json", ...cors },
  });
}
// Deno runtime (Supabase Edge Function) — zéro markdown, zéro CJS.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...corsHeaders },
  });
}

Deno.serve(async (req: Request) => {
  // CORS preflight
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    // URL imports compatibles Deno
    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2.47.6");

    const env = Deno.env.toObject();
    const supabaseUrl = env.SUPABASE_URL;
    const serviceRole = env.SUPABASE_SERVICE_ROLE_KEY ?? env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !serviceRole) {
      return json({ ok: false, error: "Missing SUPABASE_URL or SERVICE_ROLE/ANON" }, 500);
    }

    const supabase = createClient(supabaseUrl, serviceRole);

    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    // TODO: brancher ici votre logique "execute" (claim job, exécuter, update status…)

    return json({ ok: true, received: body });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return json({ ok: false, error: msg }, 500);
  }
});

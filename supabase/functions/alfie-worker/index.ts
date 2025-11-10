import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async () => {
  try {
    const url = must("SUPABASE_URL");
    const service = must("SUPABASE_SERVICE_ROLE_KEY");
    const sb = createClient(url, service);

    // 1) Prendre un job en file
    const { data: jobs } = await sb
      .from("jobs")
      .select("*")
      .in("status", ["queued", "retry"])
      .order("created_at", { ascending: true })
      .limit(1);
    const job = jobs?.[0];
    if (!job) return json({ ok: true, message: "No job" });

    // 2) Exécuter
    const resp = await fetch(new URL("/functions/v1/alfie-execute", url).toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${service}` },
      body: JSON.stringify({ jobId: job.id }),
    });

    if (!resp.ok) {
      // retry simple
      const attempt = (job.attempt ?? 0) + 1;
      const status = attempt >= 3 ? "error" : "retry";
      await sb.from("jobs").update({ status, attempt }).eq("id", job.id);
      return json({ ok: false, error: await resp.text() }, 500);
    }

    return json({ ok: true, jobId: job.id });
  } catch (e) {
    return json({ ok: false, error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

function must(k: string) { const v = Deno.env.get(k); if (!v) throw new Error(`Missing env ${k}`); return v; }
function json(x: unknown, s = 200) { return new Response(JSON.stringify(x), { status: s, headers: { "Content-Type": "application/json" } }); }

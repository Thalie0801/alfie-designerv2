// @ts-nocheck
// @ts-nocheck  (tu peux typer plus tard)
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...corsHeaders } });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2.47.6");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    if (!SUPABASE_URL || !ANON_KEY || !SERVICE_ROLE) return json({ ok: false, error: "Missing env" }, 500);

    // 1) Authentifier l'appelant (client) via son JWT
    const supaUser = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    });
    const { data: userData, error: authErr } = await supaUser.auth.getUser();
    if (authErr || !userData?.user) return json({ ok: false, error: "Unauthorized" }, 401);

    // 2) Vérifier qu'il est admin
    const { data: profile, error: profErr } = await supaUser
      .from("profiles")
      .select("is_admin")
      .eq("id", userData.user.id)
      .single();
    if (profErr) return json({ ok: false, error: "Profile read error" }, 500);
    if (!profile?.is_admin) return json({ ok: false, error: "Forbidden (admin only)" }, 403);

    // 3) Traiter un job avec service role
    const sb = createClient(SUPABASE_URL, SERVICE_ROLE);

    const { data: claimed, error: rpcErr } = await sb.rpc("claim_next_job");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!SUPABASE_URL || !SERVICE_ROLE) return json({ ok: false, error: "Missing env" }, 500);

    const sb = createClient(SUPABASE_URL, SERVICE_ROLE);

    // 1) Claim 1 job
    const { data: claimed, error: rpcErr } = await sb.rpc('claim_next_job');
    if (rpcErr) return json({ ok: false, error: rpcErr.message }, 500);
    if (!claimed || claimed.length === 0) return json({ ok: true, message: "No jobs" });

    const job = claimed[0];

    // TODO: logique réelle (rendu image/vidéo/carrousel) ici
    const result = { ok: true, processedAt: new Date().toISOString() };

    const { error: upErr } = await sb
      .from("job_queue")
      .update({ status: "completed", result, updated_at: new Date().toISOString() })
      .eq("id", job.id);

    if (upErr) return json({ ok: false, error: upErr.message }, 500);
    // 2) Simuler traitement (à remplacer par ton rendu réel)
    let result: Record<string, unknown> = { ok: true, processedAt: new Date().toISOString() };

    // 3) Success
    const { error: upErr } = await sb
      .from('job_queue')
      .update({ status: 'completed', result, updated_at: new Date().toISOString() })
      .eq('id', job.id);
    if (upErr) return json({ ok: false, error: upErr.message }, 500);

    return json({ ok: true, processed: job.id });
  } catch (e) {
    return json({ ok: false, error: e?.message ?? String(e) }, 500);
  }
});

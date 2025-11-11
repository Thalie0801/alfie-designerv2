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

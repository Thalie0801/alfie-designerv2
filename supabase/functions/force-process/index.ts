// supabase/functions/force-process/index.ts
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

Deno.serve(async (req) => {
  try {
    // Requiert un user connecté côté client (Bearer user JWT)
    const bearer = req.headers.get("Authorization");
    if (!bearer) return new Response("Unauthorized", { status: 401 });

    // (Optionnel) Ajouter une vérification d’admin:
    // - soit via un claim custom dans le JWT
    // - soit via une requête RLS-safe sur profile (hors scope ici)

    const url = Deno.env.get("SUPABASE_URL");
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !service) {
      return new Response("Missing SUPABASE_URL or SERVICE_ROLE", { status: 500 });
    }

    const res = await fetch(`${url}/functions/v1/process-job-worker?force=1`, {
      method: "POST",
      headers: { Authorization: `Bearer ${service}` }
    });

    const text = await res.text();
    return new Response(text, { status: res.status });
  } catch (e) {
    return new Response(`force-process error: ${e}`, { status: 500 });
  }
});

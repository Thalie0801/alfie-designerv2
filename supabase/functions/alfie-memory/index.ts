import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const url = must("SUPABASE_URL");
  const anon = must("SUPABASE_ANON_KEY");
  const auth = req.headers.get("Authorization");
  if (!auth) return json({ ok: false, error: "Unauthorized" }, 401);

  const sbUser = createClient(url, anon, { global: { headers: { Authorization: auth } } });

  try {
    const u = new URL(req.url);
    const scope = u.searchParams.get("scope") ?? "user";
    const brand = u.searchParams.get("brand_id") ?? undefined;

    if (req.method === "GET") {
      const q = sbUser.from("alfie_memory").select("id,scope,key,value,updated_at").eq("scope", scope);
      if (scope === "brand" && brand) q.eq("brand_id", brand);
      const { data, error } = await q;
      if (error) throw error;
      return json({ ok: true, data });
    }

    if (req.method === "POST") {
      const body = await req.json();
      const { data, error } = await sbUser.from("alfie_memory").insert(body).select("*").single();
      if (error) throw error;
      return json({ ok: true, data });
    }

    if (req.method === "PUT") {
      const body = await req.json();
      const { id, ...patch } = body;
      const { data, error } = await sbUser.from("alfie_memory").update(patch).eq("id", id).select("*").single();
      if (error) throw error;
      return json({ ok: true, data });
    }

    if (req.method === "DELETE") {
      const id = new URL(req.url).searchParams.get("id");
      if (!id) return json({ ok: false, error: "Missing id" }, 400);
      const { error } = await sbUser.from("alfie_memory").delete().eq("id", id);
      if (error) throw error;
      return json({ ok: true });
    }

    return json({ ok: false, error: "Method Not Allowed" }, 405);
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
function must(k: string) { const v = Deno.env.get(k); if (!v) throw new Error(`Missing env ${k}`); return v; }
function json(x: unknown, s = 200) { return new Response(JSON.stringify(x), { status: s, headers: { "Content-Type": "application/json", ...cors } }); }

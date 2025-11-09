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
    const auth = req.headers.get("Authorization") ?? "";
    const jwt = auth.replace(/^Bearer\s+/i, "");
    const supa = createClient(SUPABASE_URL, SERVICE_KEY, {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
    });

    const body = await req.json().catch(() => ({}));
    const { brand_id, payload } = body as Record<string, unknown>;

    // 1) récupérer l'utilisateur appelant (sécurité)
    const { data: userRes, error: userErr } = await supa.auth.getUser(jwt);
    if (userErr || !userRes?.user) {
      return json({ ok: false, error: "unauthenticated" }, 401);
    }
    const user_id = userRes.user.id;

    // 2) créer l'order
    const { data: order, error: oErr } = await supa
      .from("orders")
      .insert({
        user_id,
        brand_id,
        status: "pending",
        source: "studio",
        meta: { payload },
      })
      .select("id")
      .single();

    if (oErr) {
      return json(
        { ok: false, error: `order_insert:${oErr.message}` },
        400,
      );
    }

    // 3) enqueuer le job
    const { data: job, error: jErr } = await supa
      .from("job_queue")
      .insert({
        order_id: order.id,
        user_id,
        type: "generate_image",
        status: "pending",
        attempts: 0,
        payload,
      })
      .select("id")
      .single();

    if (jErr) {
      return json({ ok: false, error: `job_insert:${jErr.message}` }, 400);
    }

    return json({ ok: true, order_id: order.id, job_id: job.id }, 200);
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

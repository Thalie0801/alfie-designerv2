import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { cors, fail, ok } from "../_shared/http.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const ALLOWED = [
  "https://lovable.dev",
  "https://*.lovable.app",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
];

Deno.serve(async (req) => {
  const headers = cors(req.headers.get("origin"), ALLOWED);
  if (req.method === "OPTIONS") return ok({ preflight: true }, headers);

  const url = new URL(req.url);
  if (req.method === "GET" && url.searchParams.get("health") === "1") {
    return ok({ health: "up" }, headers);
  }

  if (req.method !== "POST") {
    return fail(405, "Method not allowed", null, headers);
  }

  if (!SUPABASE_URL || !SERVICE_KEY) {
    return fail(500, "Missing Supabase configuration", null, headers);
  }

  try {
    const auth = req.headers.get("Authorization") ?? "";
    const jwt = auth.replace(/^Bearer\s+/i, "").trim();
    if (!jwt) {
      return fail(401, "Missing access token", null, headers);
    }

    const supa = createClient(SUPABASE_URL, SERVICE_KEY, {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
    });

    const body = await req.json().catch(() => ({}));
    const { brand_id, payload } = body as Record<string, unknown>;

    if (typeof brand_id !== "string" || !brand_id) {
      return fail(400, "brand_id is required", { body }, headers);
    }

    const { data: userRes, error: userErr } = await supa.auth.getUser(jwt);
    if (userErr || !userRes?.user) {
      return fail(401, "Unauthenticated", userErr?.message, headers);
    }
    const user_id = userRes.user.id;

    const { data: order, error: orderError } = await supa
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

    if (orderError || !order) {
      return fail(400, "Order creation failed", orderError?.message, headers);
    }

    const { data: job, error: jobError } = await supa
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

    if (jobError || !job) {
      return fail(400, "Job enqueue failed", jobError?.message, headers);
    }

    return ok({ order_id: order.id, job_id: job.id }, headers);
  } catch (e) {
    const details = e instanceof Error ? e.message : String(e);
    return fail(500, "Generation failed", details, headers);
  }
});

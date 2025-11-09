// supabase/functions/lovable-proxy/index.ts
// Deno Deploy / Supabase Edge Function

import { cors, fail, ok } from "../_shared/http.ts";

const ALLOWED_ORIGINS = [
  "https://lovable.dev",
  "https://*.lovable.app",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
];

Deno.serve(async (req) => {
  const baseHeaders = cors(req.headers.get("origin"), ALLOWED_ORIGINS);
  if (req.method === "OPTIONS") return ok({ preflight: true }, baseHeaders);

  const url = new URL(req.url);
  if (req.method === "GET" && url.searchParams.get("health") === "1") {
    return ok({ health: "up" }, baseHeaders);
  }

  const restPath = url.pathname.replace(/^\/?lovable-proxy\/?/, "");
  const parts = restPath.split("/").filter(Boolean);
  const hasProject = parts[0] === "projects" && parts[1];
  if (!hasProject) {
    return fail(400, "Missing projectId in path", null, baseHeaders);
  }

  const LOVABLE_API_TOKEN = Deno.env.get("LOVABLE_API_TOKEN");
  if (!LOVABLE_API_TOKEN) {
    return fail(
      500,
      "Server misconfigured: LOVABLE_API_TOKEN missing",
      null,
      baseHeaders,
    );
  }

  const target = `https://api.lovable.dev/${restPath}${url.search || ""}`;

  const init: RequestInit = {
    method: req.method,
    headers: {
      "Authorization": `Bearer ${LOVABLE_API_TOKEN}`,
      "Content-Type": req.headers.get("content-type") ?? "application/json",
    },
    body: ["GET", "HEAD"].includes(req.method) ? undefined : await req.text(),
  };

  try {
    const resp = await fetch(target, init);
    const text = await resp.text();

    if (!resp.ok) {
      return fail(
        resp.status,
        "Lovable upstream error",
        text.slice(0, 500),
        baseHeaders,
      );
    }

    const contentType = resp.headers.get("content-type") ?? "application/octet-stream";
    return new Response(text, {
      status: 200,
      headers: { ...baseHeaders, "content-type": contentType },
    });
  } catch (e) {
    const details = e instanceof Error ? e.message : String(e);
    return fail(502, "Lovable proxy failed", details, baseHeaders);
  }
});

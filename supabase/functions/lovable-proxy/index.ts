// supabase/functions/lovable-proxy/index.ts
// Deno Deploy / Supabase Edge Function

const ALLOWED_ORIGINS = [
  // ← mets tes domaines app ici (production + preview)
  "https://lovable.dev",
  "https://*.lovable.app",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
];

function corsHeaders(origin: string | null) {
  const allowOrigin =
    origin && ALLOWED_ORIGINS.some((o) =>
      o.startsWith("https://*.") ? origin.endsWith(o.slice(10)) : origin === o
    )
      ? origin
      : "null";
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Headers": "authorization, content-type",
    "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
    "Vary": "Origin",
  };
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  const headers = corsHeaders(origin);

  // Preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers });
  }

  const url = new URL(req.url);
  // /lovable-proxy/<...tout le reste...>
  // ex: /lovable-proxy/projects/<projectId>/integrations/supabase
  const restPath = url.pathname.replace(/^\/?lovable-proxy\/?/, "");

  // Validation minimale projectId
  // attend "projects/<id>/..."
  const parts = restPath.split("/").filter(Boolean);
  const hasProject = parts[0] === "projects" && parts[1];
  if (!hasProject) {
    return new Response(
      JSON.stringify({ error: "Missing projectId in path" }),
      { status: 400, headers: { ...headers, "Content-Type": "application/json" } },
    );
  }

  const LOVABLE_API_TOKEN = Deno.env.get("LOVABLE_API_TOKEN");
  if (!LOVABLE_API_TOKEN) {
    return new Response(
      JSON.stringify({ error: "Server misconfigured: LOVABLE_API_TOKEN missing" }),
      { status: 500, headers: { ...headers, "Content-Type": "application/json" } },
    );
  }

  const target = `https://api.lovable.dev/${restPath}${url.search || ""}`;

  // Forward
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

    const contentType = resp.headers.get("content-type") ?? "application/octet-stream";
    const body = await resp.text(); // on transmet tel quel
    return new Response(body, {
      status: resp.status,
      headers: { ...headers, "Content-Type": contentType },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: `Lovable proxy failed: ${msg}` }), {
      status: 502,
      headers: { ...headers, "Content-Type": "application/json" },
    });
  }
});

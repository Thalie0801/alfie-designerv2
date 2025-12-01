import { corsHeaders } from "../_shared/cors.ts";

/**
 * DEPRECATED: Video slideshow generation is obsolete.
 * Use generate-video via Studio instead.
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response("ok", { headers: corsHeaders });
  }

  // Return 410 Gone - function deprecated
  return new Response(JSON.stringify({
    error: "DEPRECATED",
    message: "Cette fonction est obsolète. Utilisez generate-video via le Studio (/studio).",
    redirect: "/studio",
    status: 410
  }), { status: 410, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
});

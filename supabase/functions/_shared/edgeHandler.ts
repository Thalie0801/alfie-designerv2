import { corsHeaders } from "./cors.ts";

/**
 * Universal Edge Function Handler
 * Ensures all edge functions return 200 OK with { ok, data, error } payload
 * Handles CORS, authentication, and error wrapping consistently
 */

export async function edgeHandler(
  req: Request,
  logic: (ctx: { jwt: string | null; input: any; req: Request }) => Promise<any>
): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const auth = req.headers.get('authorization') || '';
    const jwt = auth.startsWith('Bearer ') ? auth.slice(7) : null;
    
    let input: any = {};
    try {
      const cloned = req.clone();
      input = await cloned.json();
    } catch {
      // Body vide ou non-JSON est OK
    }

    const result = await logic({ jwt, input, req });
    
    return new Response(
      JSON.stringify({ ok: true, data: result }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  } catch (e: any) {
    console.error('[edgeHandler] Error:', e.message, e.stack);
    return new Response(
      JSON.stringify({
        ok: false,
        error: e?.message || 'unexpected_error',
        code: e?.code || 'INTERNAL_ERROR'
      }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }
}

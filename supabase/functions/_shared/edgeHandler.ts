/**
 * Universal Edge Function Handler
 * Ensures all edge functions return 200 OK with { ok, data, error } payload
 * Handles CORS, authentication, and error wrapping consistently
 */

export async function edgeHandler(
  req: Request,
  logic: (_ctx: { jwt: string | null; input: any; req: Request }) => Promise<any>
): Promise<Response> {
  const origin = req.headers.get('origin') || '*';
  const cors = {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST,OPTIONS,GET',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization,x-client-info,apikey',
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: cors });
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
      { status: 200, headers: { 'Content-Type': 'application/json', ...cors } }
    );
  } catch (e: unknown) {
    if (e instanceof Response) {
      return e;
    }

    const errorMessage =
      e && typeof (e as { message?: string }).message === 'string'
        ? (e as { message: string }).message
        : 'unexpected_error';
    const status =
      typeof (e as { status?: number })?.status === 'number'
        ? (e as { status: number }).status
        : typeof (e as { context?: { status?: number } })?.context?.status === 'number'
          ? (e as { context: { status: number } }).context.status
          : 500;
    const code =
      typeof (e as { code?: string })?.code === 'string'
        ? (e as { code: string }).code
        : 'INTERNAL_ERROR';

    console.error('[edgeHandler] Error:', errorMessage, (e as { stack?: string })?.stack);

    return new Response(
      JSON.stringify({ ok: false, error: errorMessage, code }),
      { status, headers: { 'Content-Type': 'application/json', ...cors } }
    );
  }
}

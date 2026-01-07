import { createClient } from "npm:@supabase/supabase-js@2";

import { corsHeaders } from "../_shared/cors.ts";
import { SUPABASE_SERVICE_ROLE_KEY, SUPABASE_URL, validateEnv } from "../_shared/env.ts";

const envValidation = validateEnv();
if (!envValidation.valid) {
  console.error("Missing required environment variables", { missing: envValidation.missing });
}
const parseBody = async (req: Request): Promise<Record<string, string>> => {
  const contentType = req.headers.get('content-type') || '';
  try {
    if (contentType.includes('application/json')) return await req.json();
    const text = await req.text();
    const params = new URLSearchParams(text);
    const out: Record<string, string> = {};
    params.forEach((v, k) => (out[k] = v));
    return out;
  } catch (_) {
    // Support GET with query params as fallback
    const url = new URL(req.url);
    const out: Record<string, string> = {};
    url.searchParams.forEach((v, k) => (out[k] = v));
    return out;
  }
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const payload = await parseBody(req);
    const ref = payload.ref || payload.affiliate_id;

    if (!ref) {
      return new Response(JSON.stringify({ error: 'Missing ref' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    const supabaseAdmin = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    // Check if ref is a UUID or a slug
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(ref);
    
    let query = supabaseAdmin
      .from('affiliates')
      .select('name, email');
    
    if (isUUID) {
      query = query.eq('id', ref);
    } else {
      query = query.eq('slug', ref);
    }
    
    const { data, error } = await query.maybeSingle();

    if (error) {
      console.error('get-affiliate-public error:', error);
      return new Response(JSON.stringify({ error: error.message }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }

    const safeName = data?.name || (data?.email ? data.email.split('@')[0] : 'Partenaire');

    return new Response(JSON.stringify({ name: safeName }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (e: any) {
    console.error('get-affiliate-public failure:', e);
    return new Response(JSON.stringify({ error: e?.message || 'Unknown error' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});

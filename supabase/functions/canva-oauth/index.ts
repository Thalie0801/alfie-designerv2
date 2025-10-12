import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get('action');

    // Placeholder for OAuth implementation
    // In production, this would handle:
    // 1. Generating OAuth authorization URL with PKCE
    // 2. Exchanging authorization code for tokens
    // 3. Refreshing access tokens
    // 4. Storing tokens securely

    if (action === 'start') {
      // TODO: Generate OAuth URL with PKCE
      // const clientId = Deno.env.get('CANVA_CLIENT_ID');
      // const redirectUri = Deno.env.get('CANVA_REDIRECT_URI');
      
      return new Response(
        JSON.stringify({
          message: 'OAuth flow requires Canva Developer credentials',
          instructions: 'Create a Canva Connect app at https://www.canva.com/developers',
          requiredSecrets: ['CANVA_CLIENT_ID', 'CANVA_CLIENT_SECRET', 'CANVA_REDIRECT_URI'],
          authUrl: 'https://www.canva.com/apps/oauth2/authorize',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'callback') {
      const code = url.searchParams.get('code');
      
      if (!code) {
        throw new Error('No authorization code provided');
      }

      // TODO: Exchange code for tokens
      return new Response(
        JSON.stringify({
          message: 'OAuth callback received',
          code: code.substring(0, 10) + '...',
          status: 'pending_exchange'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action. Use ?action=start or ?action=callback' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in canva-oauth:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'An error occurred',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

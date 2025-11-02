import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { user_message } = await req.json();

    if (!user_message || typeof user_message !== 'string') {
      return new Response(
        JSON.stringify({ error: 'user_message is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const msg = user_message.toLowerCase();
    let intent = 'autre';

    // Classifier simple basé sur regex
    if (/carrousel|carousel|slides?|diaporama/i.test(msg)) {
      intent = 'carousel';
    } else if (/vid[eé]o|video|reel|short|story vid[eé]o|clip/i.test(msg)) {
      intent = 'video';
    } else if (/image|visuel|cover|miniature|photo|illustration/i.test(msg)) {
      intent = 'image';
    }

    console.log(`[Classifier] "${user_message}" → ${intent}`);

    return new Response(
      JSON.stringify({ intent }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('[Classifier] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

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

    // Classifier avec mots-clés précis de la spec
    if (/carrousel|carousel|slides?|diaporama|série/i.test(msg)) {
      intent = 'carousel';
      console.log(`[Classifier] Détection carousel via mots-clés: carrousel|carousel|slides|diaporama`);
    } else if (/vid[eé]o|video|reel|short|story\s*vid[eé]o|clip/i.test(msg)) {
      intent = 'video';
      console.log(`[Classifier] Détection video via mots-clés: vidéo|video|reel|short|clip`);
    } else if (/image|visuel|cover|miniature|photo|illustration/i.test(msg)) {
      intent = 'image';
      console.log(`[Classifier] Détection image via mots-clés: image|visuel|cover|miniature`);
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

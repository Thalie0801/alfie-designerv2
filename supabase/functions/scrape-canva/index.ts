import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";

import { corsHeaders } from "../_shared/cors.ts";
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { url, category } = await req.json();
    
    if (!url || !url.includes('canva.com')) {
      return new Response(
        JSON.stringify({ error: 'Valid Canva URL required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Scraping Canva URL:', url);

    // Fetch the Canva page with realistic headers (improves success rate)
    const response = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9,fr;q=0.8',
      },
    });
    const html = await response.text();

    // Extract metadata with multiple fallbacks
    const titleMatch =
      html.match(/<meta property="og:title" content="([^"]+)"/i) ||
      html.match(/<meta name="twitter:title" content="([^"]+)"/i) ||
      html.match(/<title>([^<]+)<\/title>/i);

      const ogImageMatch = html.match(/<meta property="og:image(?::secure_url)?" content="([^"]+)"/i);
      const twitterImageMatch = html.match(/<meta name="twitter:image(?::src)?" content="([^"]+)"/i);
      const imageLinkMatch = html.match(/<link rel="image_src" href="([^"]+)"/i);

    const descriptionMatch =
      html.match(/<meta property="og:description" content="([^"]+)"/i) ||
      html.match(/<meta name="description" content="([^"]+)"/i) ||
      html.match(/<meta name="twitter:description" content="([^"]+)"/i);

    let title = titleMatch ? titleMatch[1] : 'Untitled Design';
    let imageUrl = (ogImageMatch?.[1] || twitterImageMatch?.[1] || imageLinkMatch?.[1] || '').trim();
    let description = (descriptionMatch?.[1] || '').trim();

    // Normalize protocol-relative and root-relative URLs
    if (imageUrl.startsWith('//')) {
      imageUrl = 'https:' + imageUrl;
    }
    if (imageUrl.startsWith('/')) {
      imageUrl = 'https://www.canva.com' + imageUrl;
    }

    if (!imageUrl) {
      return new Response(
        JSON.stringify({ error: 'Could not extract design preview' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Save to database
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data, error } = await supabase
      .from('canva_designs')
      .insert({
        title,
        image_url: imageUrl,
        canva_url: url,
        description,
        category: category || null
      })
      .select()
      .single();

    if (error) {
      // If duplicate URL, return existing design
      if (error.code === '23505') {
        const { data: existing } = await supabase
          .from('canva_designs')
          .select()
          .eq('canva_url', url)
          .single();
        
        return new Response(
          JSON.stringify({ success: true, data: existing }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      console.error('Database error:', error);
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Design saved:', data);

    return new Response(
      JSON.stringify({ success: true, data }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Scraping error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

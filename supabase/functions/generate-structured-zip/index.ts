import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import JSZip from "https://esm.sh/jszip@3.10.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const { deliverableId } = await req.json();

    // Récupérer le livrable
    const { data: deliverable, error } = await supabaseClient
      .from('deliverable')
      .select('*')
      .eq('id', deliverableId)
      .single();

    if (error || !deliverable) {
      return new Response(JSON.stringify({ error: 'Deliverable not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Créer le ZIP structuré
    const zip = new JSZip();

    // 1. Télécharger l'asset principal
    if (deliverable.preview_url) {
      const assetResponse = await fetch(deliverable.preview_url);
      const assetBlob = await assetResponse.blob();
      const assetBuffer = await assetBlob.arrayBuffer();
      
      const extension = deliverable.format === 'image' ? 'png' : 'mp4';
      const filename = `${deliverable.format}_${deliverable.id.slice(0, 8)}.${extension}`;
      
      zip.folder('assets')?.file(filename, assetBuffer);
    }

    // 2. Générer metadata/alt_texts.json
    const altTexts = {
      [deliverable.format]: deliverable.objective || `${deliverable.format} généré avec Alfie Designer`,
      description: deliverable.objective,
      brand_id: deliverable.brand_id,
      created_at: deliverable.created_at,
    };
    zip.folder('metadata')?.file('alt_texts.json', JSON.stringify(altTexts, null, 2));

    // 3. Si vidéo, générer metadata/srt/subtitles.srt
    if (deliverable.format === 'reel') {
      const srt = `1
00:00:00,000 --> 00:00:05,000
${deliverable.objective || 'Vidéo générée par Alfie Designer'}

2
00:00:05,000 --> 00:00:10,000
Créé avec intelligence artificielle
`;
      zip.folder('metadata')?.folder('srt')?.file('subtitles.srt', srt);
    }

    // 4. Ajouter un README
    const readme = `# Livrable Alfie Designer

**Format:** ${deliverable.format}
**Objectif:** ${deliverable.objective}
**Style:** ${deliverable.style_choice}
**Créé le:** ${new Date(deliverable.created_at).toLocaleString('fr-FR')}

## Structure
- \`assets/\` : Fichiers média finaux
- \`metadata/\` : Métadonnées et textes alternatifs
  - \`alt_texts.json\` : Descriptions pour accessibilité
  - \`srt/\` : Sous-titres vidéo (si applicable)

## Expiration
Ce livrable expire 30 jours après sa création.

## Support
Pour toute question : support@alfiedesigner.com
`;
    zip.file('README.md', readme);

    // Générer le ZIP
    const zipBlob = await zip.generateAsync({ type: 'uint8array' });

    // Uploader vers Supabase Storage
    const zipFilename = `${deliverable.id}_${Date.now()}.zip`;
    const { data: uploadData, error: uploadError } = await supabaseClient.storage
      .from('media-generations')
      .upload(`zips/${zipFilename}`, zipBlob, {
        contentType: 'application/zip',
        upsert: false,
      });

    if (uploadError) {
      console.error('Error uploading ZIP:', uploadError);
      return new Response(JSON.stringify({ error: uploadError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Obtenir URL publique
    const { data: publicUrlData } = supabaseClient.storage
      .from('media-generations')
      .getPublicUrl(`zips/${zipFilename}`);

    const zip_url = publicUrlData.publicUrl;

    return new Response(JSON.stringify({ zip_url }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in generate-structured-zip:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

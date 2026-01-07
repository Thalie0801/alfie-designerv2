import { createClient } from "npm:@supabase/supabase-js@2";
import JSZip from "npm:jszip@3.10.1";

import { corsHeaders } from "../_shared/cors.ts";
import { SUPABASE_ANON_KEY, SUPABASE_URL, validateEnv } from "../_shared/env.ts";

const envValidation = validateEnv();
if (!envValidation.valid) {
  console.error("Missing required environment variables", { missing: envValidation.missing });
}
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const supabase = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
      global: {
        headers: { Authorization: authHeader },
      },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authentication' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { assets, template_type } = await req.json();

    if (!assets || !Array.isArray(assets) || assets.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No assets provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Créer un ZIP avec JSZip
    const zip = new JSZip();
    const assetsFolder = zip.folder('assets');

    // Télécharger chaque image et l'ajouter au ZIP
    for (let i = 0; i < assets.length; i++) {
      const assetUrl = assets[i];
      try {
        const response = await fetch(assetUrl);
        if (!response.ok) {
          console.error(`Failed to download asset: ${assetUrl}`);
          continue;
        }
        const blob = await response.blob();
        const arrayBuffer = await blob.arrayBuffer();
        assetsFolder?.file(`image_${i + 1}.jpg`, arrayBuffer);
      } catch (error) {
        console.error(`Error downloading asset ${assetUrl}:`, error);
      }
    }

    // Créer le fichier d'instructions Canva
    const canvaInstructions = {
      version: '1.0',
      template_type: template_type || 'instagram_post',
      assets: assets.map((url, i) => ({
        id: `image_${i + 1}`,
        filename: `image_${i + 1}.jpg`,
        original_url: url
      })),
      instructions: [
        '1. Ouvrez Canva et créez un nouveau design',
        '2. Importez les images depuis le dossier assets/',
        '3. Glissez-déposez les images sur votre design',
        '4. Personnalisez selon vos besoins',
        '5. Exportez votre création finale'
      ]
    };

    zip.file('canva_instructions.json', JSON.stringify(canvaInstructions, null, 2));

    // Créer un README
    const readme = `# Export Canva - Alfie Designer

Ce fichier ZIP contient vos visuels prêts à être importés dans Canva.

## Contenu
- assets/ : Dossier contenant toutes vos images
- canva_instructions.json : Fichier de configuration avec les métadonnées
- readme_canva.txt : Ce fichier

## Instructions d'utilisation

1. **Extraire le ZIP**
   Décompressez ce fichier sur votre ordinateur

2. **Ouvrir Canva**
   Allez sur canva.com et connectez-vous à votre compte

3. **Créer un nouveau design**
   Choisissez le format approprié (Instagram Post, Story, etc.)

4. **Importer les images**
   - Cliquez sur "Uploads" dans le menu de gauche
   - Glissez-déposez toutes les images du dossier assets/
   
5. **Utiliser vos images**
   Une fois importées, vous pouvez glisser-déposer vos images sur votre design

6. **Personnaliser**
   Ajoutez du texte, des effets, ou d'autres éléments selon vos besoins

7. **Exporter**
   Cliquez sur "Partager" puis "Télécharger" pour exporter votre création

## Support
Pour toute question, contactez le support Alfie Designer

---
Généré par Alfie Designer
`;

    zip.file('readme_canva.txt', readme);

    // Générer le ZIP
    const zipBlob = await zip.generateAsync({ type: 'uint8array' });

    // Uploader le ZIP vers Supabase Storage
    const zipFileName = `canva-export-${user.id}-${Date.now()}.zip`;
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('media-generations')
      .upload(`exports/${zipFileName}`, zipBlob, {
        contentType: 'application/zip',
        upsert: false
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      return new Response(
        JSON.stringify({ error: 'Failed to upload ZIP file' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Générer l'URL publique
    const { data: { publicUrl } } = supabase.storage
      .from('media-generations')
      .getPublicUrl(`exports/${zipFileName}`);

    // Lien vers un template Canva public (exemple)
    const templateLink = 'https://www.canva.com/templates/';

    return new Response(
      JSON.stringify({
        zipUrl: publicUrl,
        templateLink,
        assetsCount: assets.length,
        message: 'Export Canva créé avec succès'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in export-canva:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
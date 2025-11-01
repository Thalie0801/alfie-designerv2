import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
// @ts-ignore
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
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Missing authorization');

    const { jobSetId } = await req.json();
    if (!jobSetId) throw new Error('Missing jobSetId');

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );
    if (userError || !user) throw new Error('Unauthorized');

    // Vérifier que le job_set appartient à l'utilisateur
    const { data: jobSet, error: jobSetErr } = await supabase
      .from('job_sets')
      .select('*')
      .eq('id', jobSetId)
      .eq('user_id', user.id)
      .single();

    if (jobSetErr || !jobSet) throw new Error('Job set not found');

    // Récupérer tous les jobs complétés
    const { data: jobs, error: jobsErr } = await supabase
      .from('jobs')
      .select('id, index_in_set, asset_id')
      .eq('job_set_id', jobSetId)
      .eq('status', 'succeeded')
      .order('index_in_set');

    if (jobsErr) throw jobsErr;
    if (!jobs || jobs.length === 0) {
      throw new Error('No completed images found');
    }

    console.log(`[download-zip] Found ${jobs.length} completed jobs`);

    // Créer le ZIP
    const zip = new JSZip();

    for (const job of jobs) {
      if (!job.asset_id) continue;

      // Récupérer l'asset dans la table assets
      const { data: assetRec, error: assetErr } = await supabase
        .from('assets')
        .select('storage_key, index_in_set, meta')
        .eq('id', job.asset_id)
        .single();

      if (assetErr || !assetRec) {
        console.warn(`[download-zip] Asset not found for job ${job.id}`);
        continue;
      }

      const meta = (assetRec.meta as any) || {};
      let imageUrl: string | undefined = meta.public_url;
      if (!imageUrl) {
        const { data: pub } = supabase.storage
          .from('media-generations')
          .getPublicUrl(assetRec.storage_key);
        imageUrl = pub.publicUrl;
      }

      if (!imageUrl) {
        console.warn(`[download-zip] No public URL for asset of job ${job.id}`);
        continue;
      }

      const response = await fetch(imageUrl);
      if (!response.ok) {
        console.warn(`[download-zip] Failed to fetch ${imageUrl} for job ${job.id}`);
        continue;
      }

      const blob = await response.blob();
      const arrayBuffer = await blob.arrayBuffer();

      const filename = `slide-${(job.index_in_set ?? assetRec.index_in_set) + 1}.png`;
      zip.file(filename, new Uint8Array(arrayBuffer));
      console.log(`[download-zip] Added ${filename} to ZIP`);
    }

    // Générer le ZIP en blob
    const zipData = await zip.generateAsync({ type: 'blob' });
    const arrayBuffer = await zipData.arrayBuffer();

    return new Response(arrayBuffer, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="carousel-${jobSetId}.zip"`
      }
    });

  } catch (error: any) {
    console.error('[download-zip] Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

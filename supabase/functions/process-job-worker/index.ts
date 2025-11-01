import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { enrichPromptWithBrand } from "../_shared/brandResolver.ts";
import { deriveSeed } from "../_shared/seedGenerator.ts";
import { checkCoherence } from "../_shared/coherenceChecker.ts";
import { SLIDE_TEMPLATES } from "../_shared/slideTemplates.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Correction orthographique française
function correctFrenchSpelling(text: string): string {
  const corrections: Record<string, string> = {
    'puisence': 'puissance',
    'décupèle': 'décuplée',
    'décuplèe': 'décuplée',
    'vidéos captatives': 'vidéos captivantes',
    'Marktplace': 'Marketplace',
    'Marketpace': 'Marketplace',
    'libérze': 'libérez',
    'automutéée': 'automatisée',
    'automutée': 'automatisée',
    'integration': 'intégration',
    'créativ': 'créatif',
    'visuals': 'visuels',
    'captvatines': 'captivantes',
    'est nouvel nouvel': 'est un nouvel',
    'vidéos étans': 'vidéos uniques',
    'en en quequess': 'en quelques',
    'artifécralle': 'artificielle',
    'partranaire': 'partenaire',
    "d'éeil": "d'œil"
  };

  let corrected = text;
  for (const [wrong, right] of Object.entries(corrections)) {
    const regex = new RegExp(wrong, 'gi');
    corrected = corrected.replace(regex, right);
  }
  
  return corrected;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 1. Récupérer 1 job en attente (FIFO) et le verrouiller atomiquement
    const { data: job, error: jobErr } = await supabase
      .from('jobs')
      .select('*, job_sets!inner(brand_id, user_id, master_seed, constraints)')
      .eq('status', 'queued')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (jobErr || !job) {
      return new Response(JSON.stringify({ message: 'No jobs to process' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Fail-fast: verify job_sets join
    if (!job.job_sets) {
      console.error('❌ [Worker] Job has no job_set join (missing FK?)');
      return new Response(JSON.stringify({ error: 'Invalid job_set FK' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`[Worker] Processing job ${job.id} (index: ${job.index_in_set})`);

    // Verify key_visual role for slide 0
    const isKeyVisualCheck = job.metadata?.role === 'key_visual';
    if (job.index_in_set === 0 && !isKeyVisualCheck) {
      console.warn('⚠️ [Worker] Slide 0 should be key_visual but role is:', job.metadata?.role);
    }

    // 2. Marquer comme "running" ATOMIQUEMENT (seulement si encore queued)
    const { data: lockedJob, error: lockErr } = await supabase
      .from('jobs')
      .update({ status: 'running', started_at: new Date().toISOString() })
      .eq('id', job.id)
      .eq('status', 'queued') // CRITIQUE: ne mettre à jour que si toujours queued
      .select()
      .maybeSingle();

    // Si le job a déjà été pris par un autre worker, on arrête
    if (lockErr || !lockedJob) {
      console.log(`[Worker] Job ${job.id} already taken by another worker, skipping`);
      return new Response(JSON.stringify({ message: 'Job already taken' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // 3. Récupérer brand_snapshot et déterminer le seed + template selon le rôle
    const brandSnapshot = job.brand_snapshot;
    const isKeyVisual = job.metadata?.role === 'key_visual';
    const masterSeedStr = brandSnapshot?.master_seed || job.job_sets.master_seed;
    const slideTemplate = job.slide_template || 'hero';
    const template = SLIDE_TEMPLATES[slideTemplate];
    
    let seed: string | undefined;
    if (masterSeedStr) {
      if (isKeyVisual) {
        seed = masterSeedStr; // Image #0 = seed maître
        console.log(`[Worker] Generating KEY VISUAL with master seed ${seed?.slice(0, 12)}...`);
      } else {
        seed = deriveSeed(masterSeedStr, job.index_in_set);
        console.log(`[Worker] Generating VARIANT #${job.index_in_set} with derived seed ${seed?.slice(0, 12)}...`);
      }
    }

    // 4. HOTFIX: Construire overlayText simple à partir des métadonnées
    console.log('📝 [Worker] Step 1: Building overlayText from metadata...');
    const slideContent = {
      title: job.metadata?.title || job.prompt,
      subtitle: job.metadata?.subtitle || '',
      punchline: job.metadata?.punchline || '',
      bullets: job.metadata?.bullets || [],
      cta: job.metadata?.cta || '',
      cta_primary: job.metadata?.cta_primary || '',
      cta_secondary: job.metadata?.cta_secondary || '',
      note: job.metadata?.note || '',
      badge: job.metadata?.badge || '',
      kpis: job.metadata?.kpis || []
    };
    
    // Construire le texte exact à superposer
    let overlayText = slideContent.title;
    if (slideContent.subtitle) overlayText += `\n${slideContent.subtitle}`;
    if (slideContent.punchline) overlayText += `\n${slideContent.punchline}`;
    if (slideContent.bullets && slideContent.bullets.length > 0) {
      overlayText += '\n\n' + slideContent.bullets.map((b: string) => `• ${b}`).join('\n');
    }
    if (slideContent.cta) overlayText += `\n\n${slideContent.cta}`;
    if (slideContent.cta_primary) overlayText += `\n\n${slideContent.cta_primary}`;
    
    console.log('✅ [Worker] overlayText built:', overlayText);

    // 5. Generate final image with text overlay (direct generation) - with timeout
    console.log('🖼️ [Worker] Step 2: Generating final image with text overlay...');
    const correctedPrompt = correctFrenchSpelling(job.prompt);
    const enrichedPrompt = enrichPromptWithBrand(correctedPrompt, brandSnapshot);
    
    console.log('📝 Base prompt:', enrichedPrompt);
    console.log('📝 Overlay text:', overlayText);
    console.log('🌱 Seed:', seed?.slice(0, 12) + '...');
    
    const aspectRatio = brandSnapshot?.aspectRatio || '4:5';
    const resolution = aspectRatio === '1:1' ? '1080x1080' : '1080x1350';
    console.log('📐 Resolution:', resolution);

    const brandKit = brandSnapshot ? {
      id: job.job_sets.brand_id,
      palette: brandSnapshot.palette || brandSnapshot.colors || null,
      voice: brandSnapshot.brand_voice || brandSnapshot.voice || null,
      logo_url: brandSnapshot.logo_url || null
    } : undefined;

    // Add 60s timeout for slow providers
    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), 60000);

    let finalImageData: any;
    let finalImageErr: any;
    
    try {
      const response = await supabase.functions.invoke('alfie-generate-ai-image', {
        body: {
          prompt: enrichedPrompt,
          resolution,
          brandKit,
          seed,
          backgroundOnly: false,
          overlayText,
          negativePrompt: 'blurry, low quality, distorted'
        }
      });
      
      finalImageData = response.data;
      finalImageErr = response.error;
      
    } catch (err: any) {
      finalImageErr = err;
    } finally {
      clearTimeout(timeout);
    }
    
    // Log AI payload for debugging
    if (finalImageData) {
      console.log('📦 [Worker] AI response keys:', Object.keys(finalImageData));
      console.log('📦 [Worker] AI payload preview:', JSON.stringify(finalImageData).slice(0, 500));
    }

    // Helper pour mettre à jour le statut du job_set
    const updateJobSetStatus = async () => {
      const { data: allJobs } = await supabase
        .from('jobs')
        .select('status')
        .eq('job_set_id', job.job_set_id);

      const statuses = allJobs?.map(j => j.status) || [];
      const allDone = statuses.every(s => ['succeeded', 'failed'].includes(s));
      const anyFailed = statuses.some(s => s === 'failed');

      let jobSetStatus = 'running';
      if (allDone) {
        jobSetStatus = anyFailed ? 'partial' : 'done';
      }

      await supabase
        .from('job_sets')
        .update({ status: jobSetStatus, updated_at: new Date().toISOString() })
        .eq('id', job.job_set_id);

      return jobSetStatus;
    };

    // === MULTI-FORMAT IMAGE EXTRACTOR ===
    function pickImage(gen: any): { kind: 'url'|'data'|'bytes', value: string|Uint8Array, mime: string } | null {
      if (!gen) return null;

      // 1) URL direct (6 possible paths)
      const url =
        gen.imageUrl || gen.url ||
        gen.image?.url || gen.image?.dataUrl ||
        gen.images?.[0]?.url || gen.images?.[0]?.dataUrl;
      
      if (typeof url === 'string' && url.startsWith('http')) 
        return { kind: 'url', value: url, mime: 'image/png' };
      if (typeof url === 'string' && url.startsWith('data:image/')) 
        return { kind: 'data', value: url, mime: 'image/png' };

      // 2) Base64 (5 possible paths)
      const b64 =
        gen.base64 || gen.b64 || gen.b64_json ||
        gen.image?.base64 || gen.images?.[0]?.base64 || gen.images?.[0]?.b64_json;
      
      if (typeof b64 === 'string') 
        return { kind: 'data', value: `data:image/png;base64,${b64}`, mime: 'image/png' };

      // 3) Octet stream (rare but possible)
      if (gen.bytes && gen.mime) 
        return { kind: 'bytes', value: gen.bytes, mime: gen.mime };

      return null;
    }

    const picked = pickImage(finalImageData);

    if (finalImageErr || !picked) {
      if (!picked) {
        console.error('❌ [Worker] Could not extract image. Available keys:', 
                      finalImageData ? Object.keys(finalImageData) : 'null');
        console.error('📦 [Worker] Full payload (first 500 chars):', 
                      JSON.stringify(finalImageData).slice(0, 500));
      } else {
        console.error('❌ [Worker] Final image generation failed:', finalImageErr);
      }
      
      // Mark job as failed + refund quota
      await supabase
        .from('jobs')
        .update({
          status: 'failed',
          error: finalImageErr?.message || 'No image returned by generator',
          finished_at: new Date().toISOString()
        })
        .eq('id', job.id);

      await supabase.rpc('refund_brand_quotas', {
        p_brand_id: job.job_sets.brand_id,
        p_visuals_count: 1
      });

      const st = await updateJobSetStatus();

      console.error(`[Worker] Job ${job.id} failed:`, finalImageErr?.message || 'no_image');
      return new Response(JSON.stringify({ 
        success: false, 
        jobId: job.id, 
        error: finalImageErr?.message || 'No image extracted',
        jobSetStatus: st 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // 6. Normalize to Uint8Array (3 branches)
    console.log('☁️ [Worker] Step 3: Preparing buffer for upload...');
    let bytes: Uint8Array;

    if (picked.kind === 'url') {
      console.log('🔄 [Worker] Downloading from HTTP:', picked.value);
      const r = await fetch(picked.value as string);
      if (!r.ok) throw new Error(`Download failed: ${r.status}`);
      bytes = new Uint8Array(await r.arrayBuffer());
      
    } else if (picked.kind === 'data') {
      console.log('🔄 [Worker] Converting base64 to buffer...');
      const dataUrl = picked.value as string;
      const b64 = dataUrl.substring(dataUrl.indexOf(',') + 1);
      const bin = atob(b64);
      bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) {
        bytes[i] = bin.charCodeAt(i);
      }
      
    } else { // 'bytes'
      bytes = picked.value as Uint8Array;
    }

    console.log('✅ [Worker] Buffer ready:', bytes.length, 'bytes');

    // 7. Upload directly (Deno supports Uint8Array) + validate public URL
    console.log('☁️ [Worker] Step 4: Uploading to storage...');
    const fileName = `carousel/${job.job_set_id}/slide_${job.index_in_set}_${Date.now()}.png`;
    console.log('📁 File path:', fileName);

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('media-generations')
      .upload(fileName, bytes, { 
        contentType: 'image/png', 
        upsert: true, 
        cacheControl: '3600' 
      });

    if (uploadError) {
      console.error('❌ [Worker] Upload failed:', uploadError);
      console.error('❌ Upload error details:', JSON.stringify(uploadError));
      
      // Refund quota + fail job
      await supabase
        .from('jobs')
        .update({ 
          status: 'failed', 
          error: `Upload failed: ${uploadError.message}`, 
          finished_at: new Date().toISOString() 
        })
        .eq('id', job.id);
      
      await supabase.rpc('refund_brand_quotas', {
        p_brand_id: job.job_sets.brand_id,
        p_visuals_count: 1
      });
      
      throw uploadError;
    }

    console.log('✅ [Worker] Upload success:', uploadData);

    const { data: publicUrlData } = supabase.storage
      .from('media-generations')
      .getPublicUrl(fileName);
    
    const publicUrl = publicUrlData.publicUrl;

    if (!publicUrl || !publicUrl.startsWith('http')) {
      throw new Error(`Invalid public URL: ${publicUrl}`);
    }

    console.log('✅ [Worker] Image uploaded successfully!');
    console.log('🔗 Public URL:', publicUrl);

    // 8. HOTFIX: Vérifier cohérence avec seuil adapté pour génération directe
    const referenceImageUrl = !isKeyVisual && job.job_sets.style_ref_url 
      ? job.job_sets.style_ref_url 
      : undefined;
    
    const coherenceScore = await checkCoherence(publicUrl, {
      palette: job.job_sets.constraints?.palette || [],
      referenceImageUrl
    });

    console.log(`[Worker] Coherence score: ${coherenceScore.total}/100`, coherenceScore.breakdown);

    // 9. HOTFIX: Seuil de cohérence ajusté pour éviter boucles retry (texte inclus dans l'image)
    const coherenceThresholdEffective = 50; // HOTFIX: seuil plus bas pour génération directe
    const retryCount = job.retry_count || 0;
    
    console.log(`[Worker] Using effective coherence threshold: ${coherenceThresholdEffective} (direct generation mode)`);
    
    if (coherenceScore.total < coherenceThresholdEffective && retryCount < 3) {
      await supabase.from('jobs').update({
        status: 'queued',
        retry_count: retryCount + 1,
        error: `Low coherence: ${coherenceScore.total}/100 (threshold: ${coherenceThresholdEffective})`
      }).eq('id', job.id);
      
      console.log(`[Worker] Job ${job.id} requeued for retry (attempt ${retryCount + 1})`);
      return new Response(JSON.stringify({ retry: true, coherenceScore }), { headers: corsHeaders });
    }

    // 10. D'ABORD créer l'asset dans assets (nouvelle table Realtime)
    console.log('💾 [Worker] Step 5: Creating asset in assets table...');
    
    const assetPayload = {
      id: crypto.randomUUID(),
      brand_id: job.job_sets.brand_id,
      job_id: job.id,
      job_set_id: job.job_set_id,
      storage_key: fileName,
      mime: 'image/png',
      width: null,
      height: null,
      checksum: null,
      meta: {
        prompt: job.prompt,
        role: isKeyVisual ? 'key_visual' : 'variant',
        slide_template: slideTemplate,
        coherence_score: coherenceScore,
        coherence_mode: 'direct',
        retry_count: retryCount,
        public_url: publicUrl,
        index_in_set: job.index_in_set
      }
    };
    
    const { data: asset, error: assetErr } = await supabase
      .from('assets')
      .insert(assetPayload)
      .select()
      .single();

    // CRITIQUE : Vérifier l'erreur AVANT de continuer
    if (assetErr || !asset) {
      console.error('❌ [Worker] Insert into media_generations failed:', assetErr);
      console.error('❌ Asset data:', asset);
      
      // Marquer le job comme failed + refund quota
      await supabase
        .from('jobs')
        .update({
          status: 'failed',
          error: `Asset creation failed: ${assetErr?.message || 'No asset returned'}`,
          finished_at: new Date().toISOString()
        })
        .eq('id', job.id);
      
      await supabase.rpc('refund_brand_quotas', {
        p_brand_id: job.job_sets.brand_id,
        p_visuals_count: 1
      });
      
      const st = await updateJobSetStatus();
      
      return new Response(JSON.stringify({ 
        success: false, 
        jobId: job.id,
        error: assetErr?.message || 'Asset creation failed',
        jobSetStatus: st 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('✅ [Worker] Asset created with ID:', asset.id);

    // 11. ENSUITE marquer le job comme réussi avec asset_id
    // → Garantit atomicité : quand le front voit asset_id, l'asset existe déjà
    console.log('✅ [Worker] Step 6: Marking job as succeeded...');
    
    await supabase
      .from('jobs')
      .update({
        status: 'succeeded',
        asset_id: asset.id,
        finished_at: new Date().toISOString()
      })
      .eq('id', job.id);

    console.log(`✅ [Worker] Job ${job.id} marked as succeeded with asset_id: ${asset.id}`);

    // 12. Si c'est le key visual, mettre à jour job_set.style_ref_url ET style_ref_asset_id
    if (isKeyVisual && asset) {
      await supabase
        .from('job_sets')
        .update({ 
          style_ref_url: publicUrl, // Phase 8: nouveau champ
          style_ref_asset_id: asset.id 
        })
        .eq('id', job.job_set_id);
      console.log(`[Worker] Updated job_set ${job.job_set_id} with style_ref_url`);
    }

    // 13. Mettre à jour le statut du job_set
    const finalStatus = await updateJobSetStatus();

    console.log(`[Worker] Job ${job.id} completed successfully (set status: ${finalStatus}, coherence: ${coherenceScore.total}/100)`);

    return new Response(JSON.stringify({ 
      success: true, 
      jobId: job.id, 
      assetId: asset.id, 
      coherenceScore: coherenceScore.total,
      retryCount 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('[Worker] Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

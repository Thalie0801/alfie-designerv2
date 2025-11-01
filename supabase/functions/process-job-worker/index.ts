import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { enrichPromptWithBrand } from "../_shared/brandResolver.ts";
import { deriveSeed } from "../_shared/seedGenerator.ts";
import { checkCoherence } from "../_shared/coherenceChecker.ts";
import { SLIDE_TEMPLATES } from "../_shared/slideTemplates.ts";
import { renderSlideToSVG } from "../_shared/slideRenderer.ts";
import { compositeSlide } from "../_shared/imageCompositor.ts";

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
      .select('*, job_sets!inner(brand_id, user_id, master_seed, constraints, status)')
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

    // GUARD: Skip if job_set is canceled
    if (['canceled', 'failed'].includes(job.job_sets.status)) {
      console.log(`[Worker] ⏭️  Skipping job ${job.id} - job_set is ${job.job_sets.status}`);
      return new Response(JSON.stringify({ message: 'Job set canceled or failed, skipping' }), {
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
      // Normalize any string (UUID, numeric, etc.) to a stable numeric seed
      const toHash = (s: string): bigint => {
        let h = 0n;
        const MOD = (1n << 63n) - 1n;
        for (let i = 0; i < s.length; i++) {
          h = (h * 131n + BigInt(s.charCodeAt(i))) & MOD;
        }
        return h === 0n ? 1n : h;
      };

      const base = toHash(masterSeedStr);
      if (isKeyVisual) {
        seed = base.toString(); // Image #0 = seed maître (numérique)
        console.log(`[Worker] Generating KEY VISUAL with master seed ${seed?.slice(0, 12) || 'none'}...`);
      } else {
        const derived = base + (BigInt(job.index_in_set) * 982451653n);
        seed = derived.toString();
        console.log(`[Worker] Generating VARIANT #${job.index_in_set} with derived seed ${seed?.slice(0, 12) || 'none'}...`);
      }
    } else {
      console.log(`[Worker] No master seed available, generating without seed control`);
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

    // 4. Construire overlayText à partir du slideContent structuré ou des métadonnées
    console.log('📝 [Worker] Step 1: Building overlayText from structured slideContent...');
    
    const metaSlideContent = job.metadata?.slideContent;
    
    // GUARD: Fail job if slideContent is missing (plan not executed)
    if (!metaSlideContent) {
      console.error('❌ [Worker] Missing slideContent in job metadata - plan was not executed properly');
      
      await supabase
        .from('jobs')
        .update({
          status: 'failed',
          error: 'Plan missing: slideContent not found in metadata',
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
        error: 'plan_missing',
        jobSetStatus: st 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    const slideContent = {
      title: metaSlideContent.title || job.prompt,
      subtitle: metaSlideContent.subtitle || '',
      punchline: metaSlideContent.punchline || '',
      bullets: metaSlideContent.bullets || [],
      cta: metaSlideContent.cta_primary || metaSlideContent.cta || '',
      cta_primary: metaSlideContent.cta_primary || '',
      cta_secondary: metaSlideContent.cta_secondary || '',
      note: metaSlideContent.note || '',
      badge: metaSlideContent.badge || '',
      kpis: metaSlideContent.kpis || [],
      type: metaSlideContent.type || 'variant'
    };
    
    console.log(`[Worker] Using structured slideContent: type=${slideContent.type}, title="${slideContent.title}"`);
    
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

    // 5. Generate background WITHOUT text (text-first approach)
    console.log('🖼️ [Worker] Step 2: Generating background image WITHOUT text...');
    const correctedPrompt = correctFrenchSpelling(job.prompt);
    const enrichedPrompt = enrichPromptWithBrand(correctedPrompt, brandSnapshot);
    
    console.log('📝 Base prompt:', enrichedPrompt);
    console.log('🌱 Seed:', seed ? seed.slice(0, 12) + '...' : 'none');
    
    const aspectRatio = brandSnapshot?.aspectRatio || '4:5';
    const resolution = aspectRatio === '1:1' ? '1080x1080' : '1080x1350';
    console.log('📐 Resolution:', resolution);

    // Add 60s timeout for slow providers
    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), 60000);

    let backgroundImageData: any;
    let backgroundImageErr: any;
    
    try {
      const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
      if (!LOVABLE_API_KEY) throw new Error('Missing LOVABLE_API_KEY');

      const gatewayResp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        signal: ctrl.signal,
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash-image-preview',
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: `${enrichedPrompt}\n\nIMPORTANT: Create a clean marketing visual background at ${resolution} (${aspectRatio}). NO TEXT, NO LETTERS, NO TYPOGRAPHY, NO WORDS. Pure visual design only. Keep brand style consistent.\n\nNEGATIVE PROMPT: no text, no letters, no words, no typography, no captions, no labels` }
              ]
            }
          ],
          modalities: ['image', 'text']
        })
      });

      if (!gatewayResp.ok) {
        const errText = await gatewayResp.text();
        throw new Error(`AI gateway error ${gatewayResp.status}: ${errText}`);
      }

      const gatewayJson = await gatewayResp.json();
      const imgUrl = gatewayJson?.choices?.[0]?.message?.images?.[0]?.image_url?.url;
      if (!imgUrl || typeof imgUrl !== 'string') {
        throw new Error('AI did not return an image URL');
      }

      backgroundImageData = { images: [{ url: imgUrl }] };
      console.log('✅ [Worker] Background generated (no text)');
    } catch (err: any) {
      backgroundImageErr = err;
    } finally {
      clearTimeout(timeout);
    }
    
    // Log AI payload for debugging
    if (backgroundImageData) {
      console.log('📦 [Worker] AI response keys:', Object.keys(backgroundImageData));
      const dataStr = JSON.stringify(backgroundImageData);
      console.log('📦 [Worker] AI payload preview:', dataStr ? dataStr.slice(0, 500) : 'null');
    }

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

    const pickedBackground = pickImage(backgroundImageData);

    if (backgroundImageErr || !pickedBackground) {
      if (!pickedBackground) {
        console.error('❌ [Worker] Could not extract background image. Available keys:', 
                      backgroundImageData ? Object.keys(backgroundImageData) : 'null');
        const dataStr = backgroundImageData ? JSON.stringify(backgroundImageData) : 'null';
        console.error('📦 [Worker] Full payload (first 500 chars):', 
                      dataStr && typeof dataStr === 'string' ? dataStr.slice(0, 500) : dataStr);
      } else {
        console.error('❌ [Worker] Background image generation failed:', backgroundImageErr);
      }
      
      // Mark job as failed + refund quota
      await supabase
        .from('jobs')
        .update({
          status: 'failed',
          error: backgroundImageErr?.message || 'No background image returned',
          finished_at: new Date().toISOString()
        })
        .eq('id', job.id);

      await supabase.rpc('refund_brand_quotas', {
        p_brand_id: job.job_sets.brand_id,
        p_visuals_count: 1
      });

      const st = await updateJobSetStatus();

      console.error(`[Worker] Job ${job.id} failed:`, backgroundImageErr?.message || 'no_image');
      return new Response(JSON.stringify({ 
        success: false, 
        jobId: job.id, 
        error: backgroundImageErr?.message || 'No background image extracted',
        jobSetStatus: st 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // 6. Get background URL for composition
    console.log('🔗 [Worker] Step 3: Getting background URL...');
    let backgroundUrl: string;

    if (pickedBackground.kind === 'url') {
      backgroundUrl = pickedBackground.value as string;
      console.log('✅ [Worker] Using direct URL:', backgroundUrl);
    } else if (pickedBackground.kind === 'data') {
      // For data URLs, we need to upload to storage first to get a URL
      console.log('🔄 [Worker] Converting base64 to buffer for temp upload...');
      const dataUrl = pickedBackground.value as string;
      const b64 = dataUrl.substring(dataUrl.indexOf(',') + 1);
      const bin = atob(b64);
      const tempBytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) {
        tempBytes[i] = bin.charCodeAt(i);
      }
      
      const tempFileName = `carousel/${job.job_set_id}/temp_bg_${job.index_in_set}_${Date.now()}.png`;
      const { error: tempUploadError } = await supabase.storage
        .from('media-generations')
        .upload(tempFileName, tempBytes, { contentType: 'image/png', upsert: true });
      
      if (tempUploadError) throw new Error(`Temp upload failed: ${tempUploadError.message}`);
      
      const { data: tempUrlData } = supabase.storage
        .from('media-generations')
        .getPublicUrl(tempFileName);
      
      backgroundUrl = tempUrlData.publicUrl;
      console.log('✅ [Worker] Temp background uploaded:', backgroundUrl);
    } else { // 'bytes'
      // Upload bytes to get a URL
      const tempBytes = pickedBackground.value as Uint8Array;
      const tempFileName = `carousel/${job.job_set_id}/temp_bg_${job.index_in_set}_${Date.now()}.png`;
      const { error: tempUploadError } = await supabase.storage
        .from('media-generations')
        .upload(tempFileName, tempBytes, { contentType: 'image/png', upsert: true });
      
      if (tempUploadError) throw new Error(`Temp upload failed: ${tempUploadError.message}`);
      
      const { data: tempUrlData } = supabase.storage
        .from('media-generations')
        .getPublicUrl(tempFileName);
      
      backgroundUrl = tempUrlData.publicUrl;
      console.log('✅ [Worker] Temp background uploaded:', backgroundUrl);
    }

    // 7. Generate SVG text layer
    console.log('📝 [Worker] Step 4: Generating SVG text overlay...');
    
    const finalSlideContent = {
      ...slideContent,
      type: slideContent.type as 'hero' | 'problem' | 'solution' | 'impact' | 'cta'
    };
    
    const finalBrandSnapshot = {
      palette: brandSnapshot?.palette || brandSnapshot?.colors || [],
      voice: brandSnapshot?.brand_voice || brandSnapshot?.voice || null,
      logo_url: brandSnapshot?.logo_url || null,
      name: brandSnapshot?.name || 'Brand'
    };
    
    const svgTextLayer = await renderSlideToSVG(
      finalSlideContent,
      template,
      finalBrandSnapshot
    );
    
    console.log('✅ [Worker] SVG layer generated:', svgTextLayer.length, 'chars');

    // 8. Composite background + SVG text
    console.log('🎨 [Worker] Step 5: Compositing background + text...');
    const finalImageBytes = await compositeSlide(backgroundUrl, svgTextLayer);
    console.log('✅ [Worker] Composition complete:', finalImageBytes.length, 'bytes');

    // 9. Upload final composed image
    console.log('☁️ [Worker] Step 6: Uploading final image...');
    const fileName = `carousel/${job.job_set_id}/slide_${job.index_in_set}_${Date.now()}.png`;
    console.log('📁 File path:', fileName);

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('media-generations')
      .upload(fileName, finalImageBytes, { 
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

    // 8. Vérifier cohérence avec référence à la slide 0 pour cohérence du carrousel
    let referenceImageUrl: string | undefined = undefined;
    
    // Si c'est une slide variant (pas key_visual), récupérer l'URL de la slide 0 du même job_set
    if (!isKeyVisual && job.index_in_set > 0) {
      const { data: keyVisualAsset } = await supabase
        .from('assets')
        .select('meta')
        .eq('job_set_id', job.job_set_id)
        .eq('index_in_set', 0)
        .maybeSingle();
      
      if (keyVisualAsset?.meta?.public_url) {
        referenceImageUrl = keyVisualAsset.meta.public_url;
        console.log(`[Worker] Using key_visual as reference for style consistency: ${referenceImageUrl}`);
      }
    }
    
    // Fallback: utiliser style_ref_url si présent (upload manuel)
    if (!referenceImageUrl && job.job_sets.style_ref_url) {
      referenceImageUrl = job.job_sets.style_ref_url;
      console.log(`[Worker] Using style_ref_url as reference: ${referenceImageUrl}`);
    }
    
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
      index_in_set: job.index_in_set,
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
        public_url: publicUrl
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
    console.error('[Worker] Critical error:', error);
    console.error('[Worker] Error stack:', error.stack);
    
    // Tenter de marquer le job comme failed si on a un job ID
    try {
      // Extraire le job ID du contexte si possible
      const url = new URL(req.url);
      const jobId = url.searchParams.get('job_id');
      
      if (jobId) {
        console.log(`[Worker] Marking job ${jobId} as failed due to critical error`);
        
        const supabase = createClient(
          Deno.env.get('SUPABASE_URL')!,
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        );
        
        await supabase
          .from('jobs')
          .update({
            status: 'failed',
            error: `Critical worker error: ${error.message}`,
            finished_at: new Date().toISOString()
          })
          .eq('id', jobId);
        
        console.log(`[Worker] Job ${jobId} marked as failed`);
      }
    } catch (cleanupErr) {
      console.error('[Worker] Failed to mark job as failed:', cleanupErr);
    }
    
    return new Response(JSON.stringify({ 
      error: error.message,
      stack: error.stack 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

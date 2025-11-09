import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { enrichPromptWithBrand } from "../_shared/brandResolver.ts";
import { deriveSeed } from "../_shared/seedGenerator.ts";
import { checkCoherence } from "../_shared/coherenceChecker.ts";
import { SLIDE_TEMPLATES } from "../_shared/slideTemplates.ts";
import { renderSlideToSVG } from "../_shared/slideRenderer.ts";
import { compositeSlide, cleanupCloudinaryResources } from "../_shared/imageCompositor.ts";

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

  const requestBody = await req.json().catch(() => ({}));
  const requestSource =
    typeof requestBody?.source === 'string' ? requestBody.source : 'manual';
  const lockOwner = `${requestSource}:${crypto.randomUUID()}`;

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  let jobIdForCleanup: string | undefined;
  const jobStartTime = Date.now();
  const MAX_JOB_DURATION_MS = 5 * 60 * 1000; // 5 minutes
  const LOCK_TTL_SECONDS = Math.ceil(MAX_JOB_DURATION_MS / 1000);
  let lockAcquired = false;

  try {
    console.log('🚀 [Worker] Starting job processing...');

    const { data: lockData, error: lockErr } = await supabase.rpc(
      'acquire_process_job_worker_mutex',
      {
        p_owner: lockOwner,
        p_ttl_seconds: LOCK_TTL_SECONDS,
      },
    );

    if (lockErr) {
      console.error('❌ [Worker] Failed to acquire mutex:', lockErr);
      return new Response(
        JSON.stringify({ error: 'Failed to acquire worker lock' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    if (!lockData) {
      console.warn('⚠️ [Worker] Another run is already in progress');
      return new Response(
        JSON.stringify({ error: 'Worker already running' }),
        {
          status: 409,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    lockAcquired = true;

    // SANITY CHECK: Compter les jobs en attente
    const { count: queuedCount } = await supabase
      .from('job_queue')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'queued');
    
    console.log(`[WORKER] Boot: ${queuedCount ?? 0} jobs queued in job_queue`);

    // 1. Récupérer 1 job en attente (FIFO) et le verrouiller atomiquement
    const { data: job, error: jobErr } = await supabase
      .from('jobs')
      .select('*, job_sets!inner(brand_id, user_id, master_seed, constraints, status)')
      .eq('status', 'queued')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (jobErr || !job) {
      console.log('ℹ️ [Worker] No jobs to process');
      return new Response(JSON.stringify({ message: 'No jobs to process' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    jobIdForCleanup = job.id;
    console.log(`📋 [Worker] Processing job ${job.id} (index: ${job.index_in_set})`);

    // Vérifier le timeout avant chaque étape critique
    const checkTimeout = () => {
      const elapsed = Date.now() - jobStartTime;
      if (elapsed > MAX_JOB_DURATION_MS) {
        throw new Error(`Job timeout: exceeded ${MAX_JOB_DURATION_MS/1000}s maximum duration`);
      }
    };

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

    // Verify key_visual role for slide 0
    const isKeyVisualCheck = job.metadata?.role === 'key_visual';
    if (job.index_in_set === 0 && !isKeyVisualCheck) {
      console.warn('⚠️ [Worker] Slide 0 should be key_visual but role is:', job.metadata?.role);
    }

    // 2. Marquer comme "running" ATOMIQUEMENT (seulement si encore queued)
    checkTimeout();
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
    
    // FALLBACK: Support legacy jobs without slideContent wrapper
    const legacy = job.metadata || {};
    const metaSlideContent =
      job.metadata?.slideContent ??
      (
        legacy.title || legacy.subtitle || legacy.punchline || legacy.bullets || legacy.cta || legacy.kpis
          ? {
              type: legacy.slide_template || 'variant',
              title: legacy.title,
              subtitle: legacy.subtitle,
              punchline: legacy.punchline,
              bullets: legacy.bullets,
              cta: legacy.cta,
              cta_primary: legacy.cta_primary,
              cta_secondary: legacy.cta_secondary,
              note: legacy.note,
              badge: legacy.badge,
              kpis: legacy.kpis,
            }
          : null
      );
    
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
    checkTimeout();
    console.log('🖼️ [Worker] Step 2: Generating background image WITHOUT text...');
    
    // Prompt is already enriched by create-job-set with full content (bullets, KPIs, style hints)
    const correctedPrompt = correctFrenchSpelling(job.prompt);
    const enrichedPrompt = enrichPromptWithBrand(correctedPrompt, brandSnapshot);
    
    console.log('📝 Base prompt:', enrichedPrompt);
    console.log('🌱 Seed:', seed ? seed.slice(0, 12) + '...' : 'none');
    
    const aspectRatio = brandSnapshot?.aspectRatio || '4:5';
    const resolution = aspectRatio === '1:1' ? '1080x1080' : '1080x1350';
    console.log('📐 Resolution:', resolution);

    // Add 60s timeout for slow providers with retry mechanism
    let backgroundImageData: any;
    let backgroundImageErr: any;
    let retryAttempt = 0;
    const maxRetries = 1;
    
    while (retryAttempt <= maxRetries) {
      try {
        checkTimeout(); // Vérifier qu'on n'a pas dépassé le timeout global
        
        if (retryAttempt > 0) {
          console.log(`🔄 [Worker] Retry attempt ${retryAttempt}/${maxRetries} for AI generation...`);
        }
        
        const ctrl = new AbortController();
        const timeout = setTimeout(() => ctrl.abort(), 60000);

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
                  { type: 'text', text: `${enrichedPrompt}\n\nIMPORTANT: Create a professional marketing visual at ${resolution} (${aspectRatio}) that represents this content. The image should visually communicate the message and leave strategic space for text overlay. Use brand colors and style. Focus on visual storytelling that complements the text content.\n\nLANGUAGE: All visual elements, if any text appears, MUST be in FRENCH. The content is in French, so any labels, captions, or text elements should be in French.\n\nContext: This image will have text overlaid, so ensure the composition allows for readable text placement. Avoid cluttered designs.` }
                ]
              }
            ],
            modalities: ['image', 'text']
          })
        });

        clearTimeout(timeout);

        if (!gatewayResp.ok) {
          const errText = await gatewayResp.text();
          const statusCode = gatewayResp.status;
          
          // Ne pas retry sur les erreurs 4xx (client error)
          if (statusCode >= 400 && statusCode < 500) {
            console.error(`❌ [Worker] AI gateway client error ${statusCode}: ${errText}`);
            throw new Error(`AI gateway error ${statusCode}: ${errText}`);
          }
          
          // Retry sur erreurs 5xx (server error)
          if (retryAttempt < maxRetries) {
            console.warn(`⚠️ [Worker] AI gateway error ${statusCode}, will retry...`);
            retryAttempt++;
            await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2s before retry
            continue;
          }
          
          throw new Error(`AI gateway error ${statusCode}: ${errText}`);
        }

        const gatewayJson = await gatewayResp.json();
        const imgUrl = gatewayJson?.choices?.[0]?.message?.images?.[0]?.image_url?.url;
        if (!imgUrl || typeof imgUrl !== 'string') {
          throw new Error('AI did not return an image URL');
        }

        backgroundImageData = { images: [{ url: imgUrl }] };
        console.log('✅ [Worker] Background generated successfully' + (retryAttempt > 0 ? ` (after ${retryAttempt} retries)` : ''));
        break; // Success, exit retry loop
        
      } catch (err: any) {
        backgroundImageErr = err;
        
        // Si c'est une erreur de timeout ou réseau ET qu'on peut retry
        if (retryAttempt < maxRetries && (err.name === 'AbortError' || err.message?.includes('network'))) {
          console.warn(`⚠️ [Worker] Network/timeout error, will retry: ${err.message}`);
          retryAttempt++;
          await new Promise(resolve => setTimeout(resolve, 2000));
          continue;
        }
        
        // Sinon, on arrête
        console.error('❌ [Worker] AI generation failed:', err.message);
        break;
      }
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

    // 8. Composite background + SVG text via Cloudinary with retry
    // Implement retry with fallback to background-only if SVG fails
    checkTimeout();
    console.log('🎨 [Worker] Step 5: Compositing background + text via Cloudinary...');
    
    // Extract primary and secondary colors from brand for tint
    const primaryColor = brandSnapshot?.primary_color || brandSnapshot?.palette?.[0];
    const secondaryColor = brandSnapshot?.secondary_color || brandSnapshot?.palette?.[1];
    
    let finalUrl = backgroundUrl; // Default to background if everything fails
    let compositionFailed = false;
    let compositionAttempts = 0;
    const maxCompositionAttempts = 2;
    let composedResult: { url: string; bgPublicId: string; svgPublicId: string } | null = null;
    
    while (compositionAttempts < maxCompositionAttempts) {
      try {
        compositionAttempts++;
        console.log(`🎨 [Worker] Composition attempt ${compositionAttempts}/${maxCompositionAttempts}`);
        
        composedResult = await compositeSlide(
          backgroundUrl, 
          svgTextLayer, 
          job.job_set_id, 
          job.job_sets.brand_id,
          primaryColor && secondaryColor ? {
            primaryColor,
            secondaryColor,
            tintStrength: 60
          } : undefined
        );
        
        finalUrl = composedResult.url;
        console.log('✅ [Worker] Composition complete, URL:', finalUrl);
        break; // Success
        
      } catch (compositionError: unknown) {
        const errorMessage = compositionError instanceof Error ? compositionError.message : String(compositionError);
        console.error(`❌ [Worker] Composition attempt ${compositionAttempts} failed:`, errorMessage);
        
        if (compositionAttempts >= maxCompositionAttempts) {
          // Fallback: use background-only (without text overlay)
          console.warn('⚠️ [Worker] Using background-only fallback (no text overlay)');
          finalUrl = backgroundUrl;
          compositionFailed = true;
          
          // Update job metadata to warn about missing text
          await supabase
            .from('jobs')
            .update({
              metadata: {
                ...job.metadata,
                composition_warning: 'Text overlay failed, using background only',
                composition_error: errorMessage
              }
            })
            .eq('id', job.id);
          
          break;
        }
        
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    // 9. Download composed/background image
    checkTimeout();
    const imageSource = compositionFailed ? 'background (fallback)' : 'composed image';
    console.log(`⬇️ [Worker] Downloading ${imageSource}...`);
    const imageResponse = await fetch(finalUrl);
    if (!imageResponse.ok) {
      throw new Error(`Failed to download ${imageSource}: ${imageResponse.status}`);
    }
    const finalImageBytes = new Uint8Array(await imageResponse.arrayBuffer());
    console.log('✅ [Worker] Image downloaded:', finalImageBytes.length, 'bytes');

    // 10. Upload final composed image to Supabase Storage (avec brand_id pour isolation multi-tenant)
    checkTimeout();
    console.log('☁️ [Worker] Step 6: Uploading final image to Supabase...');
    const brandId = job.job_sets.brand_id;
    const fileName = `carousel/${brandId}/${job.job_set_id}/slide_${job.index_in_set}_${Date.now()}.png`;
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

    // Cleanup Cloudinary temporary assets if composition succeeded
    if (composedResult) {
      await cleanupCloudinaryResources({ 
        bgPublicId: composedResult.bgPublicId, 
        svgPublicId: composedResult.svgPublicId 
      });
    }

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
    }, composedResult?.bgPublicId || '');

    console.log(`[Worker] Coherence score: ${coherenceScore.total}/100`, coherenceScore.breakdown);

    // 9. If coherence is low and composition succeeded, retry with stronger tint
    const coherenceThresholdEffective = 60;
    const retryCount = job.retry_count || 0;
    let updatedPublicUrl = publicUrl; // Track potentially updated URL
    
    console.log(`[Worker] Using effective coherence threshold: ${coherenceThresholdEffective} (with brand tint)`);
    
    if (coherenceScore.total < coherenceThresholdEffective && retryCount === 0 && composedResult) {
      // ONE TIME retry with stronger tint (only if composition succeeded initially)
      console.log(`[Worker] Low coherence (${coherenceScore.total}), retrying with stronger tint...`);
      
      // Re-composite with stronger tint
      const strongerTint = await compositeSlide(
        backgroundUrl,
        svgTextLayer,
        job.job_set_id,
        job.job_sets.brand_id,
        primaryColor && secondaryColor ? {
          primaryColor,
          secondaryColor,
          tintStrength: 80 // Stronger tint
        } : undefined
      );
      
      // Re-download and upload
      const retryImageResponse = await fetch(strongerTint.url);
      if (retryImageResponse.ok) {
        const retryImageBytes = new Uint8Array(await retryImageResponse.arrayBuffer());
        const retryFileName = `carousel/${brandId}/${job.job_set_id}/slide_${job.index_in_set}_retry_${Date.now()}.png`;
        
        const { data: retryUploadData, error: retryUploadError } = await supabase.storage
          .from('media-generations')
          .upload(retryFileName, retryImageBytes, { 
            contentType: 'image/png', 
            upsert: true, 
            cacheControl: '3600' 
          });
        
        if (!retryUploadError && retryUploadData) {
          const { data: retryPublicUrlData } = supabase.storage
            .from('media-generations')
            .getPublicUrl(retryFileName);
          
          const retryPublicUrl = retryPublicUrlData.publicUrl;
          
          // Re-check coherence
          const retryCoherenceScore = await checkCoherence(retryPublicUrl, {
            palette: job.job_sets.constraints?.palette || [],
            referenceImageUrl
          }, strongerTint.bgPublicId);
          
          console.log(`[Worker] Retry coherence score: ${retryCoherenceScore.total}/100`);
          
          // Use retry image if better
          if (retryCoherenceScore.total > coherenceScore.total) {
            console.log(`[Worker] Using retry image (better score: ${retryCoherenceScore.total} > ${coherenceScore.total})`);
            // Cleanup old upload
            await supabase.storage.from('media-generations').remove([fileName]);
            // Update to use retry
            composedResult.url = strongerTint.url;
            composedResult.bgPublicId = strongerTint.bgPublicId;
            composedResult.svgPublicId = strongerTint.svgPublicId;
            updatedPublicUrl = retryPublicUrl;
            coherenceScore.total = retryCoherenceScore.total;
            coherenceScore.breakdown = retryCoherenceScore.breakdown;
          }
        }
        
        await cleanupCloudinaryResources({ bgPublicId: strongerTint.bgPublicId, svgPublicId: strongerTint.svgPublicId });
      }
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
        public_url: updatedPublicUrl
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

    // 🔥 Quota consumption confirmed (reserve_brand_quotas already incremented images_used)
    console.log(`💰 [Worker] Quota consumption confirmed for brand ${job.job_sets.brand_id} (1 visual)`);

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
    console.error('❌ [Worker] Critical error:', error);
    console.error('📍 [Worker] Error stack:', error.stack);
    
    // Tenter de marquer le job comme failed
    if (jobIdForCleanup) {
      try {
        console.log(`🔄 [Worker] Attempting to mark job ${jobIdForCleanup} as failed...`);
        
        const errorMessage = error.message || 'Unknown error';
        const isTimeout = errorMessage.includes('timeout') || errorMessage.includes('exceeded');

        await supabase
          .from('jobs')
          .update({
            status: 'failed',
            error: isTimeout ? `Timeout: ${errorMessage}` : `Critical error: ${errorMessage}`,
            finished_at: new Date().toISOString()
          })
          .eq('id', jobIdForCleanup);
        
        console.log(`✅ [Worker] Job ${jobIdForCleanup} marked as failed`);
        
        // Refund quota si c'est un échec critique (pas un timeout de lock)
        if (!errorMessage.includes('already taken')) {
          const { data: jobData } = await supabase
            .from('jobs')
            .select('job_sets!inner(brand_id)')
            .eq('id', jobIdForCleanup)
            .maybeSingle();
          
          if (jobData?.job_sets) {
            const jobSets: any = jobData.job_sets;
            const brandId = Array.isArray(jobSets) 
              ? jobSets[0]?.brand_id 
              : jobSets.brand_id;
            
            if (brandId) {
              await supabase.rpc('refund_brand_quotas', {
                p_brand_id: brandId,
                p_visuals_count: 1
              });
              console.log(`💰 [Worker] Quota refunded for brand ${brandId}`);
            }
          }
        }
      } catch (cleanupErr) {
        console.error('❌ [Worker] Failed to mark job as failed:', cleanupErr);
      }
    }
    
    return new Response(JSON.stringify({ 
      error: error.message,
      timeout: error.message?.includes('timeout') || false,
      jobId: jobIdForCleanup
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } finally {
    if (lockAcquired) {
      try {
        await supabase.rpc('release_process_job_worker_mutex', {
          p_owner: lockOwner,
        });
      } catch (releaseErr) {
        console.error('❌ [Worker] Failed to release mutex:', releaseErr);
      }
    }
  }
});

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

    console.log(`[Worker] Processing job ${job.id} (index: ${job.index_in_set})`);

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

    // 5. HOTFIX: Génération directe "image finale" avec texte inclus
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

    const { data: finalImageData, error: finalImageErr } = await supabase.functions.invoke('alfie-generate-ai-image', {
      body: {
        prompt: enrichedPrompt,
        resolution,
        brandKit,
        seed,
        backgroundOnly: false, // HOTFIX: génération avec texte
        overlayText, // HOTFIX: texte exact à inclure
        negativePrompt: 'blurry, low quality, distorted'
      }
    });
    
    console.log('🔍 [Worker] AI response:', finalImageErr ? 'ERROR' : 'SUCCESS');
    console.log('📊 [Worker] Response data keys:', finalImageData ? Object.keys(finalImageData) : 'null');
    
    const finalImageUrl = finalImageData?.imageUrl || finalImageData?.url;
    console.log('✅ [Worker] Final image URL type:', finalImageUrl ? (finalImageUrl.startsWith('data:') ? 'BASE64' : 'HTTP') : 'NONE');

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

    if (finalImageErr || !finalImageUrl) {
      console.error('❌ [Worker] Final image generation failed:', finalImageErr);
      // Échec → marquer et refund
      await supabase
        .from('jobs')
        .update({
          status: 'failed',
          error: finalImageErr?.message || 'Final image generation failed',
          finished_at: new Date().toISOString()
        })
        .eq('id', job.id);

      await supabase.rpc('refund_brand_quotas', {
        p_brand_id: job.job_sets.brand_id,
        p_visuals_count: 1
      });

      await updateJobSetStatus();

      console.error(`[Worker] Job ${job.id} failed:`, finalImageErr?.message);
      return new Response(JSON.stringify({ success: false, jobId: job.id, error: finalImageErr?.message }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // 6. HOTFIX: Gérer base64 → upload Storage
    console.log('☁️ [Worker] Step 3: Processing image for upload...');
    let uploadBuffer: Uint8Array;
    
    if (finalImageUrl.startsWith('data:image/png;base64,')) {
      console.log('🔄 [Worker] Converting base64 to buffer...');
      const base64Data = finalImageUrl.replace(/^data:image\/png;base64,/, '');
      const binaryString = atob(base64Data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      uploadBuffer = bytes;
      console.log('✅ [Worker] Base64 converted to buffer:', uploadBuffer.length, 'bytes');
    } else if (finalImageUrl.startsWith('http')) {
      console.log('🔄 [Worker] Downloading image from HTTP URL...');
      const imageResponse = await fetch(finalImageUrl);
      const arrayBuffer = await imageResponse.arrayBuffer();
      uploadBuffer = new Uint8Array(arrayBuffer);
      console.log('✅ [Worker] Image downloaded:', uploadBuffer.length, 'bytes');
    } else {
      throw new Error(`Unsupported image URL format: ${finalImageUrl.substring(0, 50)}`);
    }
    
    // 7. Upload vers Supabase Storage avec URL publique
    console.log('☁️ [Worker] Step 4: Uploading to storage...');
    const fileName = `carousel/${job.job_set_id}/slide_${job.index_in_set}_${Date.now()}.png`;
    console.log('📁 File path:', fileName);
    
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('media-generations')
      .upload(fileName, uploadBuffer, {
        contentType: 'image/png',
        upsert: true,
        cacheControl: '3600'
      });

    if (uploadError) {
      console.error('❌ [Worker] Upload failed:', uploadError);
      console.error('❌ Upload error details:', JSON.stringify(uploadError));
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
      throw new Error(`Invalid public URL generated: ${publicUrl}`);
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

    // 10. Créer l'asset dans media_generations
    const { data: asset } = await supabase
      .from('media_generations')
      .insert({
        user_id: job.job_sets.user_id,
        brand_id: job.job_sets.brand_id,
        type: 'image',
        output_url: publicUrl,
        status: 'completed',
        prompt: job.prompt,
        metadata: { 
          job_id: job.id, 
          job_set_id: job.job_set_id,
          coherence_score: coherenceScore,
          role: isKeyVisual ? 'key_visual' : 'variant',
          slide_template: slideTemplate,
          retry_count: retryCount
        }
      })
      .select()
      .single();

    // 11. Marquer le job comme réussi
    await supabase
      .from('jobs')
      .update({
        status: 'succeeded',
        asset_id: asset.id,
        finished_at: new Date().toISOString()
      })
      .eq('id', job.id);

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

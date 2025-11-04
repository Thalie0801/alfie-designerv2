import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  type ConversationState,
  type ConversationContext,
  detectOrderIntent,
  getNextQuestion,
  shouldTransitionState,
  extractResponseValue,
  isSkipResponse,
  detectTopicIntent
} from "../_shared/conversationFlow.ts";

const sb = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const corsHeaders = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type',
  'access-control-allow-methods': 'POST,OPTIONS',
};

const json = (data: any, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json',
      ...corsHeaders,
    }
  });

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  
  try {
    const body = await req.json();
    const { message: user_message, conversationId: session_id, brandId: brand_id } = body;

    console.log('[ORCH] 📩 Received:', { session_id, brand_id, msg: user_message?.substring(0, 50) });

    // Auth
    const authHeader = req.headers.get('authorization');
    if (!authHeader) throw new Error('Missing authorization');

    const userClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user } } = await userClient.auth.getUser();
    if (!user) throw new Error('Unauthorized');

    // === 1. LOAD OR CREATE SESSION ===
    let session;
    if (session_id) {
      const { data } = await sb
        .from("alfie_conversation_sessions")
        .select("*")
        .eq("id", session_id)
        .single();
      session = data;
    }

    if (!session) {
      const { data: newSession, error: err } = await sb
        .from("alfie_conversation_sessions")
        .insert({
          user_id: user.id,
          brand_id: brand_id,
          conversation_state: 'initial',
          context_json: {},
          messages: []
        })
        .select()
        .single();
      if (err) throw err;
      session = newSession;
      console.log('[ORCH] ✨ New session created:', session.id);
    }

    let state: ConversationState = session.conversation_state as ConversationState;
    let context: ConversationContext = session.context_json || {};
    
    console.log('[ORCH] 📊 State:', state, 'Context:', context);

    // === 2. DETECT INTENT (si initial) ===
    if (state === 'initial') {
      const intent = detectOrderIntent(user_message || '');
      if (intent && (intent.numImages > 0 || intent.numCarousels > 0)) {
        context.numImages = intent.numImages;
        context.numCarousels = intent.numCarousels;
        context.imageBriefs = Array(intent.numImages).fill(null).map(() => ({}));
        context.carouselBriefs = Array(intent.numCarousels).fill(null).map(() => ({}));
        context.currentImageIndex = 0;
        context.currentCarouselIndex = 0;
        
        // Transition vers collecting
        if (intent.numImages > 0) {
          state = 'collecting_image_brief';
        } else if (intent.numCarousels > 0) {
          state = 'collecting_carousel_brief';
        }
        
        await sb
          .from("alfie_conversation_sessions")
          .update({ 
            conversation_state: state,
            context_json: context 
          })
          .eq("id", session.id);
        
        const nextQ = getNextQuestion(state, context);
        console.log('[ORCH] 🎯 Intent detected, asking first question');
        return json({
          response: nextQ?.question || "Super ! Dis-m'en plus.",
          quickReplies: nextQ?.quickReplies || [],
          conversationId: session.id,
          state,
          context
        });
      }
      
      // Pas d'intent détecté
      const welcomeQ = getNextQuestion('initial', context);
      return json({
        response: welcomeQ?.question || "Dis-moi ce que tu veux créer !",
        quickReplies: welcomeQ?.quickReplies || [],
        conversationId: session.id,
        state: 'initial'
      });
    }

    // === 3. COLLECTING BRIEFS ===
    if (state === 'collecting_image_brief') {
      const currentIdx = context.currentImageIndex || 0;
      const currentBrief = context.imageBriefs?.[currentIdx] || {};
      const nextQ = getNextQuestion(state, context);
      
      if (nextQ?.questionKey) {
        // Enregistrer la réponse
        const value = extractResponseValue({ key: nextQ.questionKey } as any, user_message || '');
        if (!isSkipResponse(user_message || '')) {
          currentBrief[nextQ.questionKey] = value;
        }
        context.imageBriefs![currentIdx] = currentBrief;
        
        // Mettre à jour le contexte
        await sb
          .from("alfie_conversation_sessions")
          .update({ context_json: context })
          .eq("id", session.id);
        
        console.log(`[ORCH] 📊 Image brief #${currentIdx + 1}:`, JSON.stringify(currentBrief, null, 2));
        
        // Prochaine question
        const next = getNextQuestion(state, context);
        if (next) {
          // ✅ CRITICAL FIX: Detect if image brief just became complete
          const briefIsComplete = 
            currentBrief.objective && 
            currentBrief.format;
          
          if (briefIsComplete && next.questionKey === 'objective') {
            // Image brief completed → next question is for NEXT image
            context.currentImageIndex = currentIdx + 1;
            
            await sb
              .from("alfie_conversation_sessions")
              .update({ context_json: context })
              .eq("id", session.id);
            
            console.log(`[ORCH] ✅ Image ${currentIdx + 1} completed. Moving to image ${currentIdx + 2}`);
          }
          
          return json({
            response: next.question,
            quickReplies: next.quickReplies || [],
            conversationId: session.id,
            state,
            context
          });
        }
      }
      
      // Toutes les images briefs collectés, passer aux carrousels ou confirmer
      if (context.numCarousels && context.numCarousels > 0) {
        state = 'collecting_carousel_brief';
        context.currentCarouselIndex = 0;
      } else {
        state = 'confirming';
      }
      
      await sb
        .from("alfie_conversation_sessions")
        .update({ 
          conversation_state: state,
          context_json: context 
        })
        .eq("id", session.id);
      
      const next = getNextQuestion(state, context);
      return json({
        response: next?.question || "Brief collecté !",
        quickReplies: next?.quickReplies || [],
        conversationId: session.id,
        state,
        context
      });
    }

    if (state === 'collecting_carousel_brief') {
      const currentIdx = context.currentCarouselIndex || 0;
      const currentBrief = context.carouselBriefs?.[currentIdx] || {};
      const nextQ = getNextQuestion(state, context);
      
      if (nextQ?.questionKey) {
        // ✅ NEW: AI-powered topic detection for free text input
        if (nextQ.questionKey === 'topic' && !isSkipResponse(user_message || '')) {
          const detection = await detectTopicIntent(user_message || '');
          
          if (detection.confidence > 0.7) {
            // High confidence - accept the detected topic
            currentBrief.topic = detection.topic;
            if (detection.angle) {
              currentBrief.angle = detection.angle;
            }
            context.carouselBriefs![currentIdx] = currentBrief;
            
            await sb
              .from("alfie_conversation_sessions")
              .update({ context_json: context })
              .eq("id", session.id);
            
            const next = getNextQuestion(state, context);
            return json({
              response: `✅ Sujet détecté : "${detection.topic}"${detection.angle ? ` (angle: ${detection.angle})` : ''}\n\n${next?.question || ''}`,
              quickReplies: next?.quickReplies || [],
              conversationId: session.id,
              state,
              context
            });
          } else {
            // Low confidence - ask user to clarify
            return json({
              response: `Je n'ai pas bien compris le sujet exact. Peux-tu être plus précis ?\n\nExemples :\n- "lancement de notre nouveau produit X"\n- "formation sur les réseaux sociaux"\n- "témoignages clients"`,
              quickReplies: [],
              conversationId: session.id,
              state,
              context
            });
          }
        }
        
        // Standard extraction for other fields
        const value = extractResponseValue({ key: nextQ.questionKey } as any, user_message || '');
        if (!isSkipResponse(user_message || '')) {
          currentBrief[nextQ.questionKey] = value;
        }
        context.carouselBriefs![currentIdx] = currentBrief;
        
        await sb
          .from("alfie_conversation_sessions")
          .update({ context_json: context })
          .eq("id", session.id);
        
        console.log(`[ORCH] 📊 Carousel brief #${currentIdx + 1}:`, JSON.stringify(currentBrief, null, 2));
        
        const next = getNextQuestion(state, context);
        if (next) {
          // ✅ CRITICAL FIX: Detect if carousel brief just became complete
          const briefIsComplete = 
            currentBrief.topic && 
            currentBrief.angle && 
            currentBrief.numSlides;
          
          if (briefIsComplete && next.questionKey === 'topic') {
            // Brief was just completed → next question is for NEXT carousel
            // Increment and persist the index NOW
            context.currentCarouselIndex = currentIdx + 1;
            
            await sb
              .from("alfie_conversation_sessions")
              .update({ context_json: context })
              .eq("id", session.id);
            
            console.log(`[ORCH] ✅ Carrousel ${currentIdx + 1} completed. Moving to carousel ${currentIdx + 2}`);
          }
          
          return json({
            response: next.question,
            quickReplies: next.quickReplies || [],
            conversationId: session.id,
            state,
            context
          });
        }
      }
      
      // Tous les carrousels briefs collectés, confirmer
      state = 'confirming';
      await sb
        .from("alfie_conversation_sessions")
        .update({ 
          conversation_state: state,
          context_json: context 
        })
        .eq("id", session.id);
      
      const next = getNextQuestion(state, context);
      return json({
        response: next?.question || "Brief collecté !",
        quickReplies: next?.quickReplies || [],
        conversationId: session.id,
        state,
        context
      });
    }

    // === 4. CONFIRMATION ===
    if (state === 'confirming') {
      const normalized = (user_message || '').toLowerCase();
      const confirmed = ['oui', 'ok', 'go', 'lance', 'genere', 'valide', '✅', 'confirme'].some(w => 
        normalized.includes(w)
      );
      
      if (!confirmed) {
        // User veut modifier, retour au début
        state = 'initial';
        context = {};
        await sb
          .from("alfie_conversation_sessions")
          .update({ 
            conversation_state: state,
            context_json: context 
          })
          .eq("id", session.id);
        
        return json({
          response: "Pas de souci ! On recommence. Que veux-tu créer ?",
          quickReplies: ['3 images', '2 carrousels', '1 image + 1 carrousel'],
          conversationId: session.id,
          state: 'initial'
        });
      }
      
      // Confirmation validée → GÉNÉRER
      if (session.order_id) {
        return json({
          response: "🚀 Génération déjà en cours…",
          orderId: session.order_id,
          quickReplies: [],
          conversationId: session.id,
          state: 'generating'
        });
      }
      
      // Créer order + items + jobs
      const campaign_name = `Campaign_${Date.now()}`;
      const { data: order, error: oErr } = await sb
        .from("orders")
        .insert({
          user_id: user.id,
          brand_id: brand_id,
          campaign_name,
          brief_json: context,
          status: "text_generation"
        })
        .select()
        .single();
      
      if (oErr || !order) {
        console.error('[ORCH] ❌ Order creation failed:', oErr);
        return json({ error: "order_creation_failed", details: oErr?.message }, 500);
      }
      
      console.log('[ORCH] ✅ Order created:', order.id);
      
      // Link order to session
      await sb
        .from("alfie_conversation_sessions")
        .update({ 
          order_id: order.id,
          conversation_state: 'generating' 
        })
        .eq("id", session.id);
      
      // Build aggregated order_items (max 1 per type)
      const items: any[] = [];
      const nI = context.numImages || 0;
      const nC = context.numCarousels || 0;
      
      if (nI > 0) {
        items.push({
          order_id: order.id,
          type: "image",
          sequence_number: 0,
          brief_json: { count: nI, briefs: context.imageBriefs || [] },
          status: "pending"
        });
      }
      
      if (nC > 0) {
        items.push({
          order_id: order.id,
          type: "carousel",
          sequence_number: 0,
          brief_json: { count: nC, briefs: context.carouselBriefs || [] },
          status: "pending"
        });
      }
      
      // ✅ Insert order_items with service role (idempotent - check by type)
      if (items.length) {
        // Check which item types already exist
        const { data: existing } = await sb
          .from("order_items")
          .select('id, type')
          .eq('order_id', order.id);
        
        const existingTypes = new Set(existing?.map((item: any) => item.type) || []);
        const newItems = items.filter((item: any) => !existingTypes.has(item.type));
        
        if (newItems.length > 0) {
          const { data: insertedItems, error: itemsError } = await sb
            .from("order_items")
            .insert(newItems)
            .select('id');
          
          if (itemsError) {
            console.error('[ORCH] ❌ Failed to insert items:', itemsError);
          } else {
            console.log('[ORCH] ✅ Items inserted:', insertedItems?.length || 0);
          }
        } else {
          console.log('[ORCH] ℹ️ All item types already exist');
        }
      }
      
      // ✅ NEW: Create render jobs directly (skip generate_texts intermediate step)
      const renderJobs: any[] = [];
      
      // Create render_images jobs for each image
      if (nI > 0 && context.imageBriefs) {
        for (let i = 0; i < nI; i++) {
          const brief = context.imageBriefs[i] || {};
          renderJobs.push({
            user_id: user.id,
            order_id: order.id,
            type: "render_images",
            status: "queued",
            payload: {
              userId: user.id, // ✅ Add userId for worker
              brandId: brand_id,
              orderId: order.id,
              orderItemId: items.find((it: any) => it.type === 'image')?.order_id,
              brief,
              imageIndex: i
            }
          });
        }
      }
      
      // Create render_carousels jobs for each carousel
      if (nC > 0 && context.carouselBriefs) {
        for (let i = 0; i < nC; i++) {
          const brief = context.carouselBriefs[i] || {};
          renderJobs.push({
            user_id: user.id,
            order_id: order.id,
            type: "render_carousels",
            status: "queued",
            payload: {
              userId: user.id, // ✅ Add userId for worker
              brandId: brand_id,
              orderId: order.id,
              orderItemId: items.find((it: any) => it.type === 'carousel')?.order_id,
              brief,
              carouselIndex: i
            }
          });
        }
      }
      
      // Insert render jobs (idempotent check)
      if (renderJobs.length > 0) {
        const { data: existingJobs } = await sb
          .from("job_queue")
          .select('id, type, payload')
          .eq('order_id', order.id)
          .in('type', ['render_images', 'render_carousels']);
        
        const existingCount = existingJobs?.length || 0;
        const newJobs = renderJobs.slice(existingCount); // Only insert missing jobs
        
        if (newJobs.length > 0) {
          const { error: jobError } = await sb.from("job_queue").insert(newJobs);
          
          if (jobError) {
            console.error('[ORCH] ❌ Failed to queue render jobs:', jobError);
            return json({ error: "failed_to_queue_jobs" }, 500);
          }
          
          console.log(`[ORCH] ✅ ${newJobs.length} render jobs queued for order:`, order.id);
        } else {
          console.log('[ORCH] ℹ️ All render jobs already exist for order:', order.id);
        }
      }
      
      // Invoke worker and wait for response
      try {
        const workerUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/alfie-job-worker`;
        console.log('[ORCH] 🔄 Invoking worker at:', workerUrl);
        
        const workerRes = await fetch(workerUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ trigger: 'orchestrator', orderId: order.id }),
        });
        
        if (!workerRes.ok) {
          const errorText = await workerRes.text().catch(() => 'Unknown error');
          console.error('[ORCH] ❌ Worker failed:', workerRes.status, errorText);
        } else {
          const workerData = await workerRes.json().catch(() => ({}));
          console.log('[ORCH] ✅ Worker completed:', {
            status: workerRes.status,
            processed: workerData.processed || 0,
            failed: workerData.failed || 0
          });
        }
      } catch (e) {
        console.error('[ORCH] ❌ Worker invoke failed:', e);
        // Don't fail the entire request - worker will process via cron
      }
      
      return json({
        response: "🚀 Génération lancée ! Je te tiens au courant.",
        orderId: order.id,
        quickReplies: [],
        conversationId: session.id,
        state: 'generating',
        context
      });
    }

    // === 5. GENERATING (état terminal) ===
    if (state === 'generating') {
      return json({
        response: "⏳ Génération en cours... Patience !",
        orderId: session.order_id,
        quickReplies: [],
        conversationId: session.id,
        state: 'generating'
      });
    }

    // Default fallback
    return json({
      response: "Je n'ai pas compris. Dis-moi ce que tu veux créer !",
      quickReplies: ['3 images', '2 carrousels', '1 image + 1 carrousel'],
      conversationId: session.id,
      state
    });

  } catch (e) {
    console.error('[ORCH] 💥 Fatal error:', e);
    return json({ error: "orchestrator_crash", details: String(e) }, 500);
  }
});

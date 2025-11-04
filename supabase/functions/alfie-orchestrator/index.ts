import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import {
  ConversationState,
  detectOrderIntent,
  getNextQuestion,
  buildSummary,
  shouldTransitionState,
  ConversationContext
} from "../_shared/conversationFlow.ts";
import { generateImageTexts, generateCarouselTexts } from "../_shared/textGenerator.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  console.log('[alfie-orchestrator] Request received');

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) throw new Error('Unauthorized');

    const { message, conversationId, brandId } = await req.json();

    console.log('[Orchestrator] Processing message:', {
      message: message.substring(0, 100),
      conversationId,
      brandId
    });

    // Get or create conversation session
    let session;
    if (conversationId) {
      const { data } = await supabaseClient
        .from('alfie_conversation_sessions')
        .select('*')
        .eq('id', conversationId)
        .single();
      session = data;
    }

    if (!session) {
      // Create new session
      const { data: newSession, error: createError } = await supabaseClient
        .from('alfie_conversation_sessions')
        .insert({
          user_id: user.id,
          brand_id: brandId,
          conversation_state: 'initial',
          context_json: {},
          messages: []
        })
        .select()
        .single();

      if (createError) throw createError;
      session = newSession;
    }

    let state = session.conversation_state as ConversationState;
    let context: ConversationContext = session.context_json || {};
    const messages = session.messages || [];

    // Add user message
    messages.push({
      role: 'user',
      content: message,
      timestamp: new Date().toISOString()
    });

    console.log('[Orchestrator] Current state:', state);
    console.log('[Orchestrator] Current context:', JSON.stringify(context));
    console.log('[Orchestrator] Session order_id:', session.order_id);

    // Process message based on state
    let responseText = '';
    let quickReplies: string[] = [];
    let shouldGenerate = false;

    if (state === 'initial') {
      const intent = detectOrderIntent(message);
      if (intent) {
        context.numImages = intent.numImages;
        context.numCarousels = intent.numCarousels;
        context.imageBriefs = [];
        context.carouselBriefs = [];
        context.currentImageIndex = 0;
        context.currentCarouselIndex = 0;

        responseText = `✅ Parfait ! Je vais créer:\n`;
        if (intent.numImages > 0) responseText += `- ${intent.numImages} image(s)\n`;
        if (intent.numCarousels > 0) responseText += `- ${intent.numCarousels} carrousel(s)\n\n`;
        
        state = 'collecting_order_size';
      } else {
        const next = getNextQuestion(state, context);
        responseText = next?.question || "Je n'ai pas compris. Pouvez-vous préciser combien d'images et/ou carrousels vous souhaitez ?";
        quickReplies = next?.quickReplies || [];
      }
    }

    // Handle confirming state BEFORE transition (to set shouldGenerate)
    if (state === 'confirming') {
      // Normalize message for robust confirmation detection
      const normalized = message
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, ""); // Remove accents
      
      const confirmKeywords = ['oui', 'ok', 'go', 'cest parti', 'vas y', 'lance', 'genere', 'confirme', 'partons', 'on y va'];
      const isConfirmation = confirmKeywords.some(kw => normalized.includes(kw)) || 
                            message.trim() === '✅' || 
                            message.trim() === '👍';
      
      console.log('[Orchestrator] Confirmation check:', { normalized, isConfirmation });
      
      if (isConfirmation) {
        shouldGenerate = true;
        responseText = '🚀 Génération en cours... Je commence par créer les textes optimisés pour chaque élément.';
        state = 'generating';
        console.log('[Orchestrator] Confirmation detected -> shouldGenerate=true, state=generating');
      } else {
        responseText = buildSummary(context) + '\n\nQue souhaitez-vous modifier ?';
        console.log('[Orchestrator] No confirmation detected, asking for modification');
      }
    }

    // Check for state transition (but skip if already handled above)
    if (state !== 'generating') {
      const newState = shouldTransitionState(state, context, message);
      if (newState) {
        state = newState;
        console.log('[Orchestrator] State transition to:', state);
      }
    } else {
      console.log('[Orchestrator] Already in generating state');
    }

    // Fallback: Force generation if in generating state without order but with valid briefs
    if (state === 'generating' && !session.order_id && !shouldGenerate) {
      const hasImages = (context.numImages || 0) > 0;
      const hasCarousels = (context.numCarousels || 0) > 0;
      
      if (hasImages || hasCarousels) {
        console.log('[Orchestrator] Fallback: forcing shouldGenerate=true in generating state without order_id');
        shouldGenerate = true;
        responseText = '🚀 Génération en cours... Je commence par créer les textes optimisés pour chaque élément.';
      }
    }

    // Handle state-specific logic
    if (state === 'collecting_image_brief') {
      const currentIndex = context.currentImageIndex || 0;
      
      if (currentIndex < (context.numImages || 0)) {
        // Collect brief for current image
        const brief = {
          objective: message,
          format: '1:1', // Will be refined
          index: currentIndex
        };
        
        context.imageBriefs = context.imageBriefs || [];
        context.imageBriefs.push(brief);
        context.currentImageIndex = (context.currentImageIndex || 0) + 1;

        if (context.currentImageIndex < (context.numImages || 0)) {
          responseText = `📸 Image ${context.currentImageIndex + 1}/${context.numImages}: Quel est l'objectif ?`;
          quickReplies = ['Acquisition', 'Conversion', 'Engagement'];
        } else {
          // Move to next phase
          state = context.numCarousels && context.numCarousels > 0 ? 'collecting_carousel_brief' : 'confirming';
          if (state === 'confirming') {
            responseText = buildSummary(context);
            quickReplies = ['✅ Oui, générer !', '✏️ Modifier'];
          } else {
            responseText = `🎠 Carrousel 1/${context.numCarousels}: Quel est le sujet ?`;
          }
        }
      }
    }

    if (state === 'collecting_carousel_brief') {
      const currentIndex = context.currentCarouselIndex || 0;
      
      if (currentIndex < (context.numCarousels || 0)) {
        // Collect brief for current carousel
        const brief = {
          topic: message,
          angle: 'éducatif',
          numSlides: 5,
          index: currentIndex
        };
        
        context.carouselBriefs = context.carouselBriefs || [];
        context.carouselBriefs.push(brief);
        context.currentCarouselIndex = (context.currentCarouselIndex || 0) + 1;

        if (context.currentCarouselIndex < (context.numCarousels || 0)) {
          responseText = `🎠 Carrousel ${context.currentCarouselIndex + 1}/${context.numCarousels}: Quel est le sujet ?`;
        } else {
          state = 'confirming';
          responseText = buildSummary(context);
          quickReplies = ['✅ Oui, générer !', '✏️ Modifier'];
        }
      }
    }


    // Update session
    messages.push({
      role: 'assistant',
      content: responseText,
      timestamp: new Date().toISOString()
    });

    const { error: updateError } = await supabaseClient
      .from('alfie_conversation_sessions')
      .update({
        conversation_state: state,
        context_json: context,
        messages,
        updated_at: new Date().toISOString()
      })
      .eq('id', session.id);

    if (updateError) {
      console.error('[Orchestrator] Session update error:', updateError);
    }

    // If we should generate, create the order and jobs
    let createdOrderId = session.order_id; // Start with existing order_id if any
    
    console.log('[Orchestrator] Generation decision:', {
      shouldGenerate,
      hasOrderId: !!session.order_id,
      numImages: context.numImages || 0,
      numCarousels: context.numCarousels || 0
    });
    
    if (shouldGenerate) {
      // Idempotence check: if session already has an order_id, don't recreate
      if (session.order_id) {
        console.log('[Orchestrator] Order already exists for session:', session.order_id);
        createdOrderId = session.order_id;
        
        // Check if job already exists
        const { data: existingJob } = await supabaseClient
          .from('job_queue')
          .select('id')
          .eq('order_id', session.order_id)
          .eq('type', 'generate_texts')
          .in('status', ['queued', 'processing'])
          .single();
        
        if (existingJob) {
          console.log('[Orchestrator] Job already queued/processing for order:', existingJob.id);
          // Don't recreate, just return
          responseText = '🚀 Génération en cours... Je commence par créer les textes optimisés pour chaque élément.';
        }
      } else {
        // Create new order
        try {
          const campaignName = `Campaign_${Date.now()}`;
          
          console.log('[Orchestrator] Creating order with:', {
            user_id: user.id,
            brand_id: brandId,
            campaign_name: campaignName,
            brief_json: context
          });
          
          const { data: order, error: orderError } = await supabaseClient
            .from('orders')
            .insert({
              user_id: user.id,
              brand_id: brandId,
              campaign_name: campaignName,
              status: 'text_generation',
              brief_json: context
            })
            .select()
            .single();

          if (orderError) {
            console.error('[Orchestrator] Order creation error:', orderError);
            throw orderError;
          }

          console.log('[Orchestrator] ✅ Order created successfully:', order.id);
          createdOrderId = order.id;

          // Link session to order
          await supabaseClient
            .from('alfie_conversation_sessions')
            .update({ order_id: order.id })
            .eq('id', session.id);

          // Create order items
          const items = [];
          
          for (let i = 0; i < (context.numImages || 0); i++) {
            items.push({
              order_id: order.id,
              type: 'image',
              sequence_number: i,
              brief_json: context.imageBriefs?.[i] || {},
              status: 'pending'
            });
          }

          for (let i = 0; i < (context.numCarousels || 0); i++) {
            items.push({
              order_id: order.id,
              type: 'carousel',
              sequence_number: i,
              brief_json: context.carouselBriefs?.[i] || {},
              status: 'pending'
            });
          }

          console.log('[Orchestrator] Inserting order items:', items.length);

          if (items.length > 0) {
            const { error: itemsError } = await supabaseClient
              .from('order_items')
              .insert(items);

            if (itemsError) {
              console.error('[Orchestrator] Order items creation error:', itemsError);
              throw itemsError;
            }
          }

          console.log('[Orchestrator] ✅ Order items created successfully:', items.length);

          // Create job for text generation
          const jobPayload = {
            imageBriefs: context.imageBriefs || [],
            carouselBriefs: context.carouselBriefs || [],
            brandId,
            numImages: context.numImages || 0,
            numCarousels: context.numCarousels || 0
          };

          console.log('[Orchestrator] Creating job with payload:', jobPayload);

          const { data: textJob, error: jobError } = await supabaseClient
            .from('job_queue')
            .insert({
              user_id: user.id,
              order_id: order.id,
              type: 'generate_texts',
              status: 'queued',
              payload: jobPayload
            })
            .select()
            .single();

          if (jobError) {
            console.error('[Orchestrator] Job creation error:', jobError);
            throw jobError;
          }

          console.log('[Orchestrator] ✅ Text generation job created successfully:', textJob.id);

        } catch (genError) {
          console.error('[Orchestrator] Generation setup error:', genError);
          console.error('[Orchestrator] Error details:', genError);
          responseText = '⚠️ Erreur lors de la préparation de la génération. Veuillez réessayer.';
        }
      }
    }

    // Clear quickReplies if generating
    if (state === 'generating') {
      quickReplies = [];
    }

    const responsePayload = {
      response: responseText,
      quickReplies,
      conversationId: session.id,
      orderId: createdOrderId,
      state,
      context
    };

    console.log('[Orchestrator] Final response:', {
      state,
      orderId: createdOrderId,
      hasQuickReplies: quickReplies.length > 0
    });

    return new Response(JSON.stringify(responsePayload), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('[alfie-orchestrator] Error:', error);
    return new Response(JSON.stringify({
      error: error.message,
      details: error.stack
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

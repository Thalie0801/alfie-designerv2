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
    console.log('[Orchestrator] Current context:', context);

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

    // Check for state transition
    const newState = shouldTransitionState(state, context, message);
    if (newState) {
      state = newState;
      console.log('[Orchestrator] State transition to:', state);
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

    if (state === 'confirming') {
      const normalized = message.toLowerCase();
      if (normalized.includes('oui') || normalized.includes('générer') || normalized.includes('confirmer')) {
        state = 'generating';
        shouldGenerate = true;
        responseText = '🚀 Génération en cours... Je commence par créer les textes optimisés pour chaque élément.';
      } else {
        responseText = buildSummary(context) + '\n\nQue souhaitez-vous modifier ?';
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
    let createdOrderId = null;
    
    if (shouldGenerate) {
      try {
        // Create order
        const campaignName = `Campaign_${Date.now()}`;
        
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

        if (orderError) throw orderError;

        console.log('[Orchestrator] Order created:', order.id);
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

        if (items.length > 0) {
          const { error: itemsError } = await supabaseClient
            .from('order_items')
            .insert(items);

          if (itemsError) throw itemsError;
        }

        console.log('[Orchestrator] Order items created:', items.length);

        // Create job for text generation
        const { data: textJob, error: jobError } = await supabaseClient
          .from('job_queue')
          .insert({
            user_id: user.id,
            order_id: order.id,
            type: 'generate_texts',
            status: 'queued',
            payload: {
              imageBriefs: context.imageBriefs || [],
              carouselBriefs: context.carouselBriefs || [],
              brandId,
              numImages: context.numImages || 0,
              numCarousels: context.numCarousels || 0
            }
          })
          .select()
          .single();

        if (jobError) {
          console.error('[Orchestrator] Job creation error:', jobError);
          throw jobError;
        }

        console.log('[Orchestrator] Text generation job created:', textJob.id);

      } catch (genError) {
        console.error('[Orchestrator] Generation setup error:', genError);
        responseText += '\n\n⚠️ Erreur lors de la préparation de la génération. Veuillez réessayer.';
      }
    }

    return new Response(JSON.stringify({
      response: responseText,
      quickReplies,
      conversationId: session.id,
      orderId: createdOrderId,
      state,
      context
    }), {
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

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const sb = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")! // bypass RLS pour writes
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

    console.log('[ORCH] Request received:', { session_id, brand_id, message_preview: user_message?.substring(0, 50) });

    // Authentification
    const authHeader = req.headers.get('authorization');
    if (!authHeader) throw new Error('Missing authorization header');

    const userClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user } } = await userClient.auth.getUser();
    if (!user) throw new Error('Unauthorized');

    // 1. Charger ou créer session
    let session;
    if (session_id) {
      const { data } = await sb
        .from("alfie_conversation_sessions").select("*").eq("id", session_id).single();
      session = data;
    }

    if (!session) {
      const { data: newSession, error: createError } = await sb
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

      if (createError) throw createError;
      session = newSession;
    }

    const state = session.conversation_state;
    const context = session.context_json || {};
    const hasOrder = !!session.order_id;
    const nI = Number(context.numImages || 0);
    const nC = Number(context.numCarousels || 0);
    const countsSum = nI + nC;

    console.log('[ORCH] pre', { state, hasOrder, nI, nC, countsSum });

    // 2. Détection confirmation (AVANT toute mise à jour)
    const normalized = (user_message || "").toLowerCase();
    const msgOk = ["oui","ok","go","vas y","lance","genere","cest parti","on y va","valide","✅","👍"]
      .some(t => normalized.includes(t) || user_message?.trim() === t);
    let shouldGenerate = Boolean(context.shouldGenerate) || msgOk;

    // FALLBACK AVANT mise à jour : si state='generating' && !order_id && counts>0
    if (!shouldGenerate && state === "generating" && !hasOrder && countsSum > 0) {
      shouldGenerate = true;
      console.warn('[ORCH] Fallback forcing shouldGenerate', { session_id: session.id, state, countsSum });
    }

    console.log('[ORCH] shouldGenerate decision:', shouldGenerate);

    // 3. Si rien à générer → retour quick replies
    if (!shouldGenerate || countsSum === 0) {
      return json({
        response: "Dis-moi quoi générer (image, carrousel) et combien.",
        quickReplies: ["1 image", "5 images", "1 carrousel"],
        conversationId: session.id
      });
    }

    // 4. IDEMPOTENCE : si order déjà lié
    if (hasOrder) {
      console.info('[ORCH] order already exists', { order_id: session.order_id });
      return json({ response: "🚀 Génération en cours…", orderId: session.order_id, quickReplies: [], conversationId: session.id });
    }

    // 5. Créer order
    const brief = context.brief ?? session.last_brief ?? "";
    const campaign_name = `Campaign_${Date.now()}`;

    console.info('[ORCH] creating order', { user_id: user.id, brand_id, campaign_name });

    const { data: order, error: oErr } = await sb
      .from("orders")
      .insert({ 
        user_id: user.id,
        brand_id: brand_id, 
        campaign_name, 
        brief_json: context,
        status: "text_generation" 
      })
      .select().single();

    if (oErr || !order) {
      console.error('[ORCH] order_insert_error', oErr);
      return json({ error: "order_insert_failed", details: oErr?.message }, 500);
    }

    console.log('[ORCH] ✅ Order created:', order.id);

    // 6. Lier session → order
    const { error: linkErr } = await sb
      .from("alfie_conversation_sessions")
      .update({ order_id: order.id, conversation_state: "generating" })
      .eq("id", session.id);
    if (linkErr) console.error('[ORCH] session_link_error', linkErr);

    // 7. Items (idempotents via unique idx)
    const items: any[] = [];
    for (let i = 0; i < nI; i++) {
      items.push({ 
        order_id: order.id, 
        type: "image", 
        sequence_number: i,
        brief_json: context.imageBriefs?.[i] || {},
        status: "pending"
      });
    }
    for (let i = 0; i < nC; i++) {
      items.push({ 
        order_id: order.id, 
        type: "carousel", 
        sequence_number: i,
        brief_json: context.carouselBriefs?.[i] || {},
        status: "pending"
      });
    }

    if (items.length) {
      const { error: itErr } = await sb.from("order_items").insert(items);
      if (itErr) console.warn('[ORCH] items_insert_warn', itErr);
      else console.info('[ORCH] ✅ items_created', { count: items.length });
    }

    // 8. Enqueue job (idempotent via unique(order_id, type, status))
    const jobPayload = {
      imageBriefs: context.imageBriefs || [],
      carouselBriefs: context.carouselBriefs || [],
      brandId: brand_id,
      numImages: nI,
      numCarousels: nC
    };

    const { error: jErr } = await sb
      .from("job_queue")
      .insert({ 
        user_id: user.id,
        order_id: order.id, 
        type: "generate_texts", 
        status: "queued",
        payload: jobPayload
      });
    if (jErr) console.error('[ORCH] job_enqueue_error', jErr);
    else console.info('[ORCH] ✅ job_queued', { order_id: order.id });

    return json({ 
      response: "🚀 Génération en cours…", 
      orderId: order.id, 
      quickReplies: [],
      conversationId: session.id,
      state: "generating",
      context
    });

  } catch (e) {
    console.error('[ORCH] fatal', e);
    return json({ error: "orchestrator_crash", details: String(e) }, 500);
  }
});

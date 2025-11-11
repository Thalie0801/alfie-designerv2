// functions/alfie-orchestrator/index.ts
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY, INTERNAL_FN_SECRET } from "../_shared/env.ts";
import {
  type ConversationState,
  type ConversationContext,
  detectOrderIntent,
  getNextQuestion,
  extractResponseValue,
  isSkipResponse,
  detectTopicIntent,
} from "../_shared/conversationFlow.ts";

// ---- Supabase (service role pour la persistance session/ordres/jobs)
const sb = createClient(SUPABASE_URL ?? "", SUPABASE_SERVICE_ROLE_KEY ?? "");

// ---- CORS / helpers
const corsHeaders = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-max-age": "86400",
};

const json = (data: any, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json", ...corsHeaders },
  });

// ---- Small utils
const toInt = (v: any, d = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
};

// parse "9:16 • 12s" / "16:9 10s" / "9:16" / "12s"
function parseFormatDuration(msg: string): { aspectRatio?: "9:16" | "16:9"; durationSec?: number } {
  const fmtMatch = msg.match(/\b(9:16|16:9)\b/i);
  const durMatch = msg.match(/\b(\d{1,2})\s*s\b/i);
  return {
    aspectRatio: fmtMatch ? (fmtMatch[1] as "9:16" | "16:9") : undefined,
    durationSec: durMatch ? parseInt(durMatch[1], 10) : undefined,
  };
}

async function appendMessage(sessionId: string, role: "user" | "assistant", content: string) {
  try {
    const { data: s } = await sb.from("alfie_conversation_sessions").select("messages").eq("id", sessionId).single();

    const msgs = Array.isArray(s?.messages) ? s!.messages : [];
    msgs.push({ role, content, at: new Date().toISOString() });

    await sb
      .from("alfie_conversation_sessions")
      .update({ messages: msgs.slice(-50) })
      .eq("id", sessionId);
  } catch (e) {
    console.warn("[ORCH] messages.append warning:", e);
  }
}

function assertBriefsValid(ctx: any) {
  const imagesOk = (ctx.imageBriefs || []).every((b: any) => b?.objective && b?.content && b?.format);
  const carouselsOk = (ctx.carouselBriefs || []).every((b: any) => b?.topic && b?.angle && toInt(b?.numSlides, 0) > 0);

  if ((ctx.numImages && !imagesOk) || (ctx.numCarousels && !carouselsOk)) {
    throw new Error("Briefs incomplete");
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const {
      message,
      user_message: userMessageField,
      conversationId: session_id,
      brandId: brand_id,
      forceTool,
    } = body;

    const user_message =
      typeof message === "string" && message.trim().length > 0
        ? message
        : typeof userMessageField === "string"
        ? userMessageField
        : "";

    console.log("[ORCH] 📩 Received:", {
      session_id,
      brand_id,
      msg: (user_message || "").substring(0, 80),
    });

    // --- Auth côté user
    const authHeader = req.headers.get("authorization");
    if (!authHeader) return json({ error: "Missing authorization" }, 401);

    const userClient = createClient(SUPABASE_URL ?? "", SUPABASE_ANON_KEY ?? "", {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: auth } = await userClient.auth.getUser();
    const user = auth?.user;
    if (!user) return json({ error: "Unauthorized" }, 401);

    // --- 1) Charger/créer la session
    let session: any;
    if (session_id) {
      const { data, error } = await sb.from("alfie_conversation_sessions").select("*").eq("id", session_id).single();
      if (error) console.warn("[ORCH] loadSession error:", error);
      session = data;
    }

    if (!session) {
      const { data: newSession, error: err } = await sb
        .from("alfie_conversation_sessions")
        .insert({
          user_id: user.id,
          brand_id,
          conversation_state: "initial",
          context_json: {},
          messages: [],
        })
        .select()
        .single();
      if (err) return json({ error: "session_create_failed", details: err.message }, 500);
      session = newSession;
      console.log("[ORCH] ✨ New session:", session.id);
    }

    let state: ConversationState = session.conversation_state as ConversationState;
    let context: ConversationContext = session.context_json || {};

    // Historiser le message user
    if (user_message) {
      await appendMessage(session.id, "user", user_message);
    }

    console.log("[ORCH] 📊 State:", state, "Context:", context);

    if (forceTool === "generate_video" && (body?.aspectRatio || body?.durationSec || body?.uploadedSourceUrl)) {
      const aspectRatio = (body?.aspectRatio as "9:16" | "16:9" | "1:1") ?? "9:16";
      const duration = Number(body?.durationSec) || 12;
      const promptText = (user_message || "").trim();
      const sourceUrl = body?.uploadedSourceUrl || null;

      let orderId: string | null = session.order_id;
      if (!orderId) {
        const { data: order, error: oErr } = await sb
          .from("orders")
          .insert({
            user_id: user.id,
            brand_id: brand_id,
            campaign_name: `Video_${Date.now()}`,
            brief_json: {
              video: { aspectRatio, durationSec: duration, prompt: promptText, sourceUrl },
            },
          })
          .select()
          .single();
        if (oErr) return json({ error: "order_creation_failed", details: oErr.message }, 500);
        orderId = order.id;
        await sb.from("alfie_conversation_sessions").update({ order_id: orderId }).eq("id", session.id);
      }

      await sb.from("job_queue").insert({
        user_id: user.id,
        order_id: orderId,
        type: "generate_video",
        status: "queued",
        payload: {
          userId: user.id,
          brandId: brand_id,
          orderId,
          aspectRatio,
          duration,
          prompt: promptText,
          sourceUrl,
        },
      });

      try {
        await fetch(`${SUPABASE_URL}/functions/v1/alfie-job-worker`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
            "X-Internal-Secret": INTERNAL_FN_SECRET || "",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ trigger: "video" }),
        });
      } catch (workerErr) {
        console.warn("[ORCH] Worker trigger failed (non-blocking):", workerErr);
      }

      await appendMessage(session.id, "assistant", "🚀 Vidéo lancée depuis le Studio.");
      await sb
        .from("alfie_conversation_sessions")
        .update({ conversation_state: "generating" })
        .eq("id", session.id);

      return json({ response: "OK", orderId, conversationId: session.id, state: "generating" });
    }

    if (forceTool === "generate_image") {
      const promptText = (user_message || body?.prompt || "").trim();
      if (!promptText) return json({ error: "missing_prompt" }, 400);

      const sourceUrl = body?.uploadedSourceUrl || null;

      let orderId = session.order_id;
      if (!orderId) {
        const { data: order, error: oErr } = await sb
          .from("orders")
          .insert({
            user_id: user.id,
            brand_id: brand_id,
            campaign_name: `Image_${Date.now()}`,
            brief_json: { image: { prompt: promptText, sourceUrl } },
          })
          .select()
          .single();
        if (oErr) return json({ error: oErr.message }, 500);
        orderId = order.id;
        await sb.from("alfie_conversation_sessions").update({ order_id: orderId }).eq("id", session.id);
      }

      const finalOrderId = orderId as string;

      await sb.from("job_queue").insert({
        user_id: user.id,
        order_id: finalOrderId,
        type: "render_images",
        status: "queued",
        payload: {
          userId: user.id,
          brandId: brand_id,
          orderId: finalOrderId,
          prompt: promptText,
          sourceUrl,
        },
      });

      try {
        await fetch(`${SUPABASE_URL}/functions/v1/alfie-job-worker`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
            "X-Internal-Secret": INTERNAL_FN_SECRET || "",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ trigger: "image" }),
        });
      } catch (workerErr) {
        console.warn("[ORCH] Worker trigger failed (non-blocking):", workerErr);
      }

      const responseText = "🚀 Génération lancée !";
      await appendMessage(session.id, "assistant", responseText);
      await sb
        .from("alfie_conversation_sessions")
        .update({ conversation_state: "generating" })
        .eq("id", session.id);

      return json({
        response: responseText,
        orderId: finalOrderId,
        conversationId: session.id,
        state: "generating",
      });
    }

    if (forceTool === "render_carousel") {
      const slides = body?.slides;
      if (!Array.isArray(slides) || slides.length === 0) {
        return json({ error: "missing_slides" }, 400);
      }

      let orderId: string | null = session.order_id;
      if (!orderId) {
        const { data: order, error: oErr } = await sb
          .from("orders")
          .insert({
            user_id: user.id,
            brand_id: brand_id,
            campaign_name: `Carousel_${Date.now()}`,
            brief_json: { carousel: { slides } },
          })
          .select()
          .single();
        if (oErr) return json({ error: oErr.message }, 500);
        orderId = order.id;
        await sb.from("alfie_conversation_sessions").update({ order_id: orderId }).eq("id", session.id);
      }

      const finalOrderId = orderId as string;

      await sb.from("job_queue").insert({
        user_id: user.id,
        order_id: finalOrderId,
        type: "render_carousels",
        status: "queued",
        payload: {
          userId: user.id,
          brandId: brand_id,
          orderId: finalOrderId,
          slides,
        },
      });

      try {
        await fetch(`${SUPABASE_URL}/functions/v1/alfie-job-worker`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
            "X-Internal-Secret": INTERNAL_FN_SECRET || "",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ trigger: "carousel" }),
        });
      } catch (workerErr) {
        console.warn("[ORCH] Worker trigger failed (non-blocking):", workerErr);
      }

      const responseText = "🚀 Génération lancée !";
      await appendMessage(session.id, "assistant", responseText);
      await sb
        .from("alfie_conversation_sessions")
        .update({ conversation_state: "generating" })
        .eq("id", session.id);

      return json({
        response: responseText,
        orderId: finalOrderId,
        conversationId: session.id,
        state: "generating",
      });
    }

    const VIDEO_RE = /\b(vid[ée]o|reel|r[ée]el|tiktok|shorts?|clip)\b/i;
    const isVideoFlowActive =
      state === "awaiting_video_params" ||
      state === "awaiting_video_prompt" ||
      (state === "generating" && Boolean(context?.video));

    if (
      !isVideoFlowActive &&
      (forceTool === "generate_video" || VIDEO_RE.test(user_message || ""))
    ) {
      context.video = {
        aspectRatio: null,
        durationSec: null,
        prompt: null,
        sourceUrl: body?.uploadedSourceUrl || null,
      };
      state = "awaiting_video_params";
      await sb
        .from("alfie_conversation_sessions")
        .update({ conversation_state: state, context_json: context })
        .eq("id", session.id);

      const responseText =
        "🎬 Format vidéo ? 9:16 (vertical) ou 16:9 (paysage) — et durée ? (5–15 s conseillé)";
      const quickReplies = ["9:16 • 7s", "9:16 • 12s", "16:9 • 10s", "16:9 • 15s"];
      await appendMessage(session.id, "assistant", responseText);
      return json({
        response: responseText,
        quickReplies,
        conversationId: session.id,
        state,
      });
    }

    if (state === "awaiting_video_params") {
      context.video = context.video || {
        aspectRatio: null,
        durationSec: null,
        prompt: null,
        sourceUrl: body?.uploadedSourceUrl || null,
      };

      const { aspectRatio, durationSec } = parseFormatDuration(user_message || "");
      if (aspectRatio) context.video!.aspectRatio = aspectRatio;
      if (durationSec) context.video!.durationSec = durationSec;
      if (!context.video!.sourceUrl && body?.uploadedSourceUrl) {
        context.video!.sourceUrl = body.uploadedSourceUrl;
      }

      await sb
        .from("alfie_conversation_sessions")
        .update({ context_json: context })
        .eq("id", session.id);

      if (!context.video!.aspectRatio || !context.video!.durationSec) {
        const responseText =
          "Il me faut le **format** (9:16 / 16:9) et la **durée** (ex: 12s).";
        const quickReplies = ["9:16 • 12s", "16:9 • 10s"];
        await appendMessage(session.id, "assistant", responseText);
        return json({
          response: responseText,
          quickReplies,
          conversationId: session.id,
          state,
        });
      }

      state = "awaiting_video_prompt";
      await sb
        .from("alfie_conversation_sessions")
        .update({ conversation_state: state })
        .eq("id", session.id);

      const responseText =
        "Parfait. Décris la scène / message de ta vidéo (ou colle un prompt).";
      await appendMessage(session.id, "assistant", responseText);
      return json({
        response: responseText,
        quickReplies: [],
        conversationId: session.id,
        state,
      });
    }

    if (state === "awaiting_video_prompt") {
      const v = (context.video || {
        aspectRatio: null,
        durationSec: null,
        prompt: null,
        sourceUrl: body?.uploadedSourceUrl || null,
      }) as any;
      const promptText = (user_message || "").trim();
      if (!promptText) {
        const responseText =
          "J’ai besoin d’un prompt pour la vidéo. Une ou deux phrases suffisent.";
        await appendMessage(session.id, "assistant", responseText);
        return json({
          response: responseText,
          conversationId: session.id,
          state,
        });
      }
      v.prompt = promptText;
      context.video = v;

      let orderId = session.order_id;
      if (!orderId) {
        const { data: order, error: oErr } = await sb
          .from("orders")
          .insert({
            user_id: user.id,
            brand_id: brand_id,
            campaign_name: `Video_${Date.now()}`,
            brief_json: { video: v },
          })
          .select()
          .single();
        if (oErr) return json({ error: "order_creation_failed", details: oErr.message }, 500);
        orderId = order.id;
        await sb
          .from("alfie_conversation_sessions")
          .update({ order_id: orderId })
          .eq("id", session.id);
      }

      const job = {
        user_id: user.id,
        order_id: orderId,
        type: "generate_video",
        status: "queued" as const,
        payload: {
          userId: user.id,
          brandId: brand_id,
          orderId,
          aspectRatio: v.aspectRatio,
          duration: v.durationSec,
          prompt: v.prompt,
          sourceUrl: v.sourceUrl || null,
        },
      };
      await sb.from("job_queue").insert(job);

      try {
        await fetch(`${SUPABASE_URL}/functions/v1/alfie-job-worker`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
            "X-Internal-Secret": INTERNAL_FN_SECRET || "",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ trigger: "video" }),
        });
      } catch (workerErr) {
        console.warn("[ORCH] Worker trigger failed (non-blocking):", workerErr);
      }

      state = "generating";
      await sb
        .from("alfie_conversation_sessions")
        .update({ conversation_state: state, context_json: context })
        .eq("id", session.id);

      const responseText = "🚀 Vidéo lancée ! Je te préviens dès que c’est prêt.";
      await appendMessage(session.id, "assistant", responseText);
      return json({
        response: responseText,
        orderId,
        conversationId: session.id,
        state,
      });
    }

    // --- 2) INITIAL : détecter l'intent "commande"
    if (state === "initial") {
      const intent = detectOrderIntent(user_message || "");
      if (intent && (intent.numImages > 0 || intent.numCarousels > 0)) {
        context.numImages = intent.numImages;
        context.numCarousels = intent.numCarousels;
        context.imageBriefs = Array(intent.numImages)
          .fill(null)
          .map(() => ({}));
        context.carouselBriefs = Array(intent.numCarousels)
          .fill(null)
          .map(() => ({}));
        context.currentImageIndex = 0;
        context.currentCarouselIndex = 0;

        // Transition
        if (intent.numImages > 0) state = "collecting_image_brief";
        else if (intent.numCarousels > 0) state = "collecting_carousel_brief";

        await sb
          .from("alfie_conversation_sessions")
          .update({ conversation_state: state, context_json: context })
          .eq("id", session.id);

        const nextQ = getNextQuestion(state, context);
        const text = nextQ?.question || "Super ! Dis-m’en plus.";
        await appendMessage(session.id, "assistant", text);
        return json({
          response: text,
          quickReplies: nextQ?.quickReplies || [],
          conversationId: session.id,
          state,
          context,
        });
      }

      const welcomeQ = getNextQuestion("initial", context);
      const text = welcomeQ?.question || "Dis-moi ce que tu veux créer !";
      await appendMessage(session.id, "assistant", text);
      return json({
        response: text,
        quickReplies: welcomeQ?.quickReplies || [],
        conversationId: session.id,
        state: "initial",
      });
    }

    // --- 3) COLLECTING IMAGE BRIEFS
    if (state === "collecting_image_brief") {
      const currentIdx = context.currentImageIndex || 0;
      const currentBrief: any = context.imageBriefs?.[currentIdx] || {};
      const nextQ = getNextQuestion(state, context);

      if (nextQ?.questionKey) {
        // enregistrer la réponse
        const value = extractResponseValue({ key: nextQ.questionKey } as any, user_message || "");
        if (!isSkipResponse(user_message || "")) currentBrief[nextQ.questionKey] = value;
        context.imageBriefs![currentIdx] = currentBrief;

        await sb.from("alfie_conversation_sessions").update({ context_json: context }).eq("id", session.id);

        // calculer la prochaine question
        const next = getNextQuestion(state, context);
        if (next) {
          // si l'image devient complète et qu'on revient à objective → passer à l'image suivante
          const briefIsComplete = currentBrief.objective && currentBrief.content && currentBrief.format;
          if (briefIsComplete && next.questionKey === "objective") {
            context.currentImageIndex = currentIdx + 1;
            await sb.from("alfie_conversation_sessions").update({ context_json: context }).eq("id", session.id);
          }
          await appendMessage(session.id, "assistant", next.question);
          return json({
            response: next.question,
            quickReplies: next.quickReplies || [],
            conversationId: session.id,
            state,
            context,
          });
        }
      }

      // Toutes les images complétées
      if (context.numCarousels && context.numCarousels > 0) {
        state = "collecting_carousel_brief";
        context.currentCarouselIndex = 0;
      } else {
        state = "confirming";
      }

      await sb
        .from("alfie_conversation_sessions")
        .update({ conversation_state: state, context_json: context })
        .eq("id", session.id);

      const next = getNextQuestion(state, context);
      const text = next?.question || "Brief collecté !";
      await appendMessage(session.id, "assistant", text);
      return json({
        response: text,
        quickReplies: next?.quickReplies || [],
        conversationId: session.id,
        state,
        context,
      });
    }

    // --- 3bis) COLLECTING CAROUSEL BRIEFS
    if (state === "collecting_carousel_brief") {
      const currentIdx = context.currentCarouselIndex || 0;
      const currentBrief: any = context.carouselBriefs?.[currentIdx] || {};
      const nextQ = getNextQuestion(state, context);

      if (nextQ?.questionKey) {
        // détection AI du sujet si question = topic
        if (nextQ.questionKey === "topic" && !isSkipResponse(user_message || "")) {
          const detection = await detectTopicIntent(user_message || "");
          if (detection.confidence > 0.7) {
            currentBrief.topic = detection.topic;
            if (detection.angle) currentBrief.angle = detection.angle;
            context.carouselBriefs![currentIdx] = currentBrief;

            await sb.from("alfie_conversation_sessions").update({ context_json: context }).eq("id", session.id);

            const next = getNextQuestion(state, context);
            const text =
              `✅ Sujet détecté : "${detection.topic}"` +
              (detection.angle ? ` (angle: ${detection.angle})` : "") +
              `\n\n${next?.question || ""}`;
            await appendMessage(session.id, "assistant", text);
            return json({
              response: text,
              quickReplies: next?.quickReplies || [],
              conversationId: session.id,
              state,
              context,
            });
          } else {
            const text =
              `Je n'ai pas bien compris le sujet exact. Peux-tu être plus précis ?\n\nExemples :\n` +
              `- "lancement de notre nouveau produit X"\n- "formation sur les réseaux sociaux"\n- "témoignages clients"`;
            await appendMessage(session.id, "assistant", text);
            return json({
              response: text,
              quickReplies: [],
              conversationId: session.id,
              state,
              context,
            });
          }
        }

        // extraction standard
        const value = extractResponseValue({ key: nextQ.questionKey } as any, user_message || "");
        if (!isSkipResponse(user_message || "")) currentBrief[nextQ.questionKey] = value;
        context.carouselBriefs![currentIdx] = currentBrief;

        await sb.from("alfie_conversation_sessions").update({ context_json: context }).eq("id", session.id);

        const next = getNextQuestion(state, context);
        if (next) {
          // si le brief est complet et que la prochaine question repart sur topic → passer au prochain carrousel
          const briefIsComplete = currentBrief.topic && currentBrief.angle && toInt(currentBrief.numSlides, 0) > 0;
          if (briefIsComplete && next.questionKey === "topic") {
            context.currentCarouselIndex = currentIdx + 1;
            await sb.from("alfie_conversation_sessions").update({ context_json: context }).eq("id", session.id);
          }
          await appendMessage(session.id, "assistant", next.question);
          return json({
            response: next.question,
            quickReplies: next.quickReplies || [],
            conversationId: session.id,
            state,
            context,
          });
        }
      }

      // Tous les carrousels complétés
      state = "confirming";
      await sb
        .from("alfie_conversation_sessions")
        .update({ conversation_state: state, context_json: context })
        .eq("id", session.id);

      const next = getNextQuestion(state, context);
      const text = next?.question || "Brief collecté !";
      await appendMessage(session.id, "assistant", text);
      return json({
        response: text,
        quickReplies: next?.quickReplies || [],
        conversationId: session.id,
        state,
        context,
      });
    }

    // --- 4) CONFIRMATION
    if (state === "confirming") {
      const normalized = (user_message || "").toLowerCase();
      const confirmed = ["oui", "ok", "go", "lance", "genere", "valide", "✅", "confirme"].some((w) =>
        normalized.includes(w),
      );

      if (!confirmed) {
        state = "initial";
        context = {};
        await sb
          .from("alfie_conversation_sessions")
          .update({ conversation_state: state, context_json: context })
          .eq("id", session.id);

        const text = "Pas de souci ! On recommence. Que veux-tu créer ?";
        await appendMessage(session.id, "assistant", text);
        return json({
          response: text,
          quickReplies: ["3 images", "2 carrousels", "1 image + 1 carrousel"],
          conversationId: session.id,
          state: "initial",
        });
      }

      // Validations server-side
      try {
        assertBriefsValid(context);
      } catch {
        const text = "Il manque des infos dans le brief. On termine ça 👍";
        await appendMessage(session.id, "assistant", text);
        return json({ response: text, conversationId: session.id, state: "confirming" }, 400);
      }

      // Idempotence: si un ordre a déjà été créé sur la session
      if (session.order_id) {
        const text = "🚀 Génération déjà en cours…";
        await appendMessage(session.id, "assistant", text);
        return json({
          response: text,
          orderId: session.order_id,
          quickReplies: [],
          conversationId: session.id,
          state: "generating",
        });
      }

      // Créer l'ordre
      const campaign_name = `Campaign_${Date.now()}`;
      const { data: order, error: oErr } = await sb
        .from("orders")
        .insert({
          user_id: user.id,
          brand_id,
          campaign_name,
          brief_json: context,
        })
        .select()
        .single();

      if (oErr || !order) {
        console.error("[ORCH] ❌ Order creation failed:", oErr);
        return json({ error: "order_creation_failed", details: oErr?.message }, 500);
      }

      // Double-check idempotence (relecture rapide)
      const { data: sess2 } = await sb
        .from("alfie_conversation_sessions")
        .select("order_id")
        .eq("id", session.id)
        .single();

      if (sess2?.order_id) {
        const text = "🚀 Génération déjà en cours…";
        await appendMessage(session.id, "assistant", text);
        return json({
          response: text,
          orderId: sess2.order_id,
          quickReplies: [],
          conversationId: session.id,
          state: "generating",
        });
      }

      // Lier l'ordre à la session
      await sb
        .from("alfie_conversation_sessions")
        .update({ order_id: order.id, conversation_state: "generating" })
        .eq("id", session.id);

      // Construire order_items agrégés (max 1 par type)
      const items: any[] = [];
      const nI = toInt(context.numImages, 0);
      const nC = toInt(context.numCarousels, 0);

      if (nI > 0) {
        items.push({
          order_id: order.id,
          type: "image",
          sequence_number: 0,
          brief_json: { count: nI, briefs: context.imageBriefs || [] },
          status: "pending",
        });
      }
      if (nC > 0) {
        items.push({
          order_id: order.id,
          type: "carousel",
          sequence_number: 0,
          brief_json: { count: nC, briefs: context.carouselBriefs || [] },
          status: "pending",
        });
      }

      if (items.length > 0) {
        const { data: existing } = await sb.from("order_items").select("id, type").eq("order_id", order.id);

        const existingTypes = new Set(existing?.map((it: any) => it.type) || []);
        const newItems = items.filter((it) => !existingTypes.has(it.type));

        if (newItems.length > 0) {
          const { error: itemsError } = await sb.from("order_items").insert(newItems);
          if (itemsError) {
            console.error("[ORCH] ❌ Items insert failed:", itemsError);
          }
        }
      }

      // Recharger items avec IDs
      const { data: allOrderItems } = await sb.from("order_items").select("id, type").eq("order_id", order.id);

      // Créer jobs de rendu (sans passer par “generate_texts”)
      const renderJobs: any[] = [];
      if (nI > 0 && context.imageBriefs) {
        const imageItem = allOrderItems?.find((it: any) => it.type === "image");
        renderJobs.push({
          user_id: user.id,
          order_id: order.id,
          type: "render_images",
          status: "queued",
          payload: {
            userId: user.id,
            brandId: brand_id,
            orderId: order.id,
            orderItemId: imageItem?.id,
            brief: { count: nI, briefs: context.imageBriefs },
          },
        });
      }
      if (nC > 0 && context.carouselBriefs) {
        const carouselItem = allOrderItems?.find((it: any) => it.type === "carousel");
        renderJobs.push({
          user_id: user.id,
          order_id: order.id,
          type: "render_carousels",
          status: "queued",
          payload: {
            userId: user.id,
            brandId: brand_id,
            orderId: order.id,
            orderItemId: carouselItem?.id,
            brief: { count: nC, briefs: context.carouselBriefs },
          },
        });
      }

      if (renderJobs.length > 0) {
        const { data: existingJobs } = await sb
          .from("job_queue")
          .select("id, type")
          .eq("order_id", order.id)
          .in("type", ["render_images", "render_carousels"]);

        const existingKeys = new Set((existingJobs || []).map((j: any) => j.type));
        const newJobs = renderJobs.filter((j) => !existingKeys.has(j.type));

        if (newJobs.length > 0) {
          const { error: jobError } = await sb.from("job_queue").insert(newJobs);
          if (jobError) {
            console.error("[ORCH] ❌ Queue jobs failed:", jobError);
            return json({ error: "failed_to_queue_jobs" }, 500);
          }
        }
      }

      // Invoke worker via Supabase client
      try {
        console.log("[ORCH] ▶️ Invoking alfie-job-worker for order:", order.id);
        
        const { data: workerData, error: workerError } = await sb.functions.invoke("alfie-job-worker", {
          body: { trigger: "orchestrator", orderId: order.id }
        });
        
        if (workerError) {
          console.error("[ORCH] ❌ Worker invoke error:", workerError);
          throw new Error(`Worker invoke failed: ${workerError.message}`);
        }
        
        console.log("[ORCH] ✅ Worker response:", workerData);
      } catch (e) {
        console.error("[ORCH] ❌ Worker call failed:", e);
        // Ne pas continuer si le worker échoue
        return json({ 
          error: "worker_invocation_failed", 
          details: e instanceof Error ? e.message : String(e) 
        }, 500);
      }

      // Log queue status for monitoring
      const { data: queueStatus } = await sb
        .from("job_queue")
        .select("id, status, type")
        .eq("order_id", order.id);
      console.log("[ORCH] 📊 Queue status for order:", order.id, queueStatus);

      const text = "🚀 Génération lancée ! Je te tiens au courant.";
      await appendMessage(session.id, "assistant", text);
      return json({
        response: text,
        orderId: order.id,
        quickReplies: [],
        conversationId: session.id,
        state: "generating",
        context,
      });
    }

    // --- 5) GENERATING
    if (state === "generating") {
      if (context?.video) {
        const responseText =
          "Ta vidéo est en cours de création. Je t’envoie le lien dès que c’est prêt !";
        await appendMessage(session.id, "assistant", responseText);
        return json({
          response: responseText,
          conversationId: session.id,
          state,
          context,
        });
      }

      // Nouveau brief pendant la génération → réinitialiser et relancer
      const newIntent = detectOrderIntent(user_message || "");
      if (newIntent && (newIntent.numImages > 0 || newIntent.numCarousels > 0)) {
        await sb
          .from("alfie_conversation_sessions")
          .update({ conversation_state: "initial", context_json: {}, order_id: null })
          .eq("id", session.id);

        const newContext: any = {
          numImages: newIntent.numImages || 0,
          numCarousels: newIntent.numCarousels || 0,
          imageBriefs: Array(newIntent.numImages || 0)
            .fill(null)
            .map(() => ({})),
          carouselBriefs: Array(newIntent.numCarousels || 0)
            .fill(null)
            .map(() => ({})),
          currentImageIndex: 0,
          currentCarouselIndex: 0,
        };

        const newState: ConversationState =
          newIntent.numImages > 0 ? "collecting_image_brief" : "collecting_carousel_brief";

        await sb
          .from("alfie_conversation_sessions")
          .update({ conversation_state: newState, context_json: newContext })
          .eq("id", session.id);

        const nextQ = getNextQuestion(newState, newContext);
        const text = nextQ?.question || "Super ! Dis-m’en plus.";
        await appendMessage(session.id, "assistant", text);
        return json({
          response: text,
          quickReplies: nextQ?.quickReplies || [],
          conversationId: session.id,
          state: newState,
          context: newContext,
        });
      }

      // Raccourci : “carrousel” / “image” sans nombre
      const norm = (user_message || "").toLowerCase();
      if (/\b(carrousel|carousel)\b/.test(norm) || /\bimage\b/.test(norm)) {
        const wantsCarousel = /\b(carrousel|carousel)\b/.test(norm);
        await sb
          .from("alfie_conversation_sessions")
          .update({ conversation_state: "initial", context_json: {}, order_id: null })
          .eq("id", session.id);

        const ctx: any = wantsCarousel
          ? { numCarousels: 1, carouselBriefs: [{}], currentCarouselIndex: 0 }
          : { numImages: 1, imageBriefs: [{}], currentImageIndex: 0 };

        const newState: ConversationState = wantsCarousel ? "collecting_carousel_brief" : "collecting_image_brief";

        await sb
          .from("alfie_conversation_sessions")
          .update({ conversation_state: newState, context_json: ctx })
          .eq("id", session.id);

        const nextQ = getNextQuestion(newState, ctx);
        const text = nextQ?.question || "Super ! Dis-m’en plus.";
        await appendMessage(session.id, "assistant", text);
        return json({
          response: text,
          quickReplies: nextQ?.quickReplies || [],
          conversationId: session.id,
          state: newState,
          context: ctx,
        });
      }

      // Vérifier la complétion (assets produits vs attendus)
      if (session.order_id) {
        let expected = 0;
        const { data: items } = await sb
          .from("order_items")
          .select("type, brief_json")
          .eq("order_id", session.order_id);

        for (const it of items || []) {
          const b: any = it.brief_json || {};
          if (it.type === "image") {
            const c = typeof b.count === "number" ? b.count : Array.isArray(b.briefs) ? b.briefs.length : 0;
            expected += c || 0;
          }
          if (it.type === "carousel") {
            const briefs = Array.isArray(b.briefs) ? b.briefs : [];
            expected += briefs.reduce((sum: number, br: any) => sum + toInt(br?.numSlides, 0), 0);
          }
        }

        const { count: done } = await sb
          .from("library_assets")
          .select("id", { count: "exact", head: true })
          .eq("order_id", session.order_id);

        console.log("[ORCH] 🧮 completion_check", {
          order_id: session.order_id,
          expected,
          done: done ?? 0,
        });

        if ((done ?? 0) >= expected && expected > 0) {
          await sb.from("alfie_conversation_sessions").update({ conversation_state: "completed" }).eq("id", session.id);

          const text = "🎉 Génération terminée ! Toutes tes slides sont prêtes.";
          await appendMessage(session.id, "assistant", text);
          return json({
            response: text,
            orderId: session.order_id,
            quickReplies: ["Voir la bibliothèque", "Créer un nouveau carrousel"],
            conversationId: session.id,
            state: "completed",
          });
        }
      }

      const text = "⏳ Génération en cours... Patience !";
      await appendMessage(session.id, "assistant", text);
      return json({
        response: text,
        orderId: session.order_id,
        quickReplies: [],
        conversationId: session.id,
        state: "generating",
      });
    }

    // --- 6) COMPLETED → réinitialiser pour un nouveau flow
    if (state === "completed") {
      await sb
        .from("alfie_conversation_sessions")
        .update({ conversation_state: "initial", context_json: {}, order_id: null })
        .eq("id", session.id);

      const welcomeQ = getNextQuestion("initial", {});
      const text = welcomeQ?.question || "Que veux-tu créer maintenant ?";
      await appendMessage(session.id, "assistant", text);
      return json({
        response: text,
        quickReplies: welcomeQ?.quickReplies || ["3 images", "2 carrousels", "1 image + 1 carrousel"],
        conversationId: session.id,
        state: "initial",
      });
    }

    // --- Fallback
    const fallback = "Je n'ai pas compris. Dis-moi ce que tu veux créer !";
    await appendMessage(session.id, "assistant", fallback);
    return json({
      response: fallback,
      quickReplies: ["3 images", "2 carrousels", "1 image + 1 carrousel"],
      conversationId: session.id,
      state,
    });
  } catch (e) {
    console.error("[ORCH] 💥 Fatal error:", e);
    return json({ error: "orchestrator_crash", details: String(e) }, 500);
  }
});

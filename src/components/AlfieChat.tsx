// src/components/AlfieChat.tsx
import React, { useCallback, useEffect, useState } from "react";
import { enqueue_job, libraryLink, search_assets, studioLink } from "@/ai/tools";
import { normalizeIntent, type AlfieIntent } from "@/ai/intent";
import { Templates } from "@/ai/templates";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import TextareaAutosize from "react-textarea-autosize";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useBrandKit } from "@/hooks/useBrandKit";
import { routeUserMessage } from "@/features/chat/assistantRouter";
import type { AlfieIntent } from "@/ai/intent";
import { enqueueAlfieJob, searchAlfieAssets, type AlfieJobStatus, type LibraryAsset } from "@/api/alfie";
import { libraryLink, studioLink } from "@/lib/links";
import TextareaAutosize from "react-textarea-autosize";
import { CreateHeader } from "@/components/create/CreateHeader";
import { QuotaBar } from "@/components/create/QuotaBar";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { useLibraryAssetsSubscription } from "@/hooks/useLibraryAssetsSubscription";
import { getAspectClass, type ConversationState, type OrchestratorResponse } from "@/types/chat";
import { slideUrl } from "@/lib/cloudinary/imageUrls";
import { extractCloudNameFromUrl } from "@/lib/cloudinary/utils";
import { FLAGS } from "@/config/flags";
import { setJobContext, captureException } from "@/observability/sentry";

// =====================
// Détection d'intention vidéo
// =====================
const VIDEO_KEYWORDS = /\b(vid[ée]o|reel|r[ée]el|tiktok|shorts?|clip)\b/i;

function detectIntent(message: string): "video" | "default" {
  if (VIDEO_KEYWORDS.test(message)) return "video";
  return "default";
}

type Message = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt: string;
};

export default function AlfieChat() {
  const activeBrandId = "default-brand"; // TODO: remplace par ton vrai contexte brand
  quickReplies?: string[];
};

function generateId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? (crypto as Crypto).randomUUID()
    : Math.random().toString(36).slice(2);
}

const INITIAL_ASSISTANT: Message = {
  id: "assistant-intro",
  role: "assistant",
  content:
    "👋 Hey ! Je suis Alfie. Donne-moi un brief (format, objectif, CTA) et je te prépare un récap avant de lancer la génération.",
  createdAt: new Date().toISOString(),
};

export function AlfieChat() {
  const { activeBrandId, brandKit } = useBrandKit();
  const [messages, setMessages] = useState<Message[]>([INITIAL_ASSISTANT]);
  const videoEnabled = FLAGS.VIDEO;
  const carouselEnabled = FLAGS.CAROUSEL;

  const capabilities = [
    "Des **images** percutantes",
    ...(videoEnabled ? ["Des **vidéos** engageantes"] : []),
    ...(carouselEnabled ? ["Des **carrousels** complets"] : []),
  ];

  const welcomeLines = capabilities.length
    ? `Je peux créer pour toi :\n• ${capabilities.join("\n• ")}`
    : "Je peux t'aider à structurer tes idées créatives.";

  // === ÉTATS (déclare UNE SEULE fois) ===
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content: "Salut, je suis Alfie. Dis-moi ce que tu veux créer.",
      createdAt: new Date().toISOString(),
    },
  ]);
  const [lastIntent, setLastIntent] = useState<AlfieIntent | null>(null);

  // === HELPERS (une seule version) ===
  const addMessage = useCallback((msg: Message) => {
    setMessages((prev) => [...prev, msg]);
  }, []);

  const handleSend = useCallback(
    async (userText: string) => {
      const userMsg: Message = {
        id: crypto.randomUUID(),
        role: "user",
        content: userText,
        createdAt: new Date().toISOString(),
      };
      addMessage(userMsg);

      const intent = normalizeIntent({
        brandId: activeBrandId,
        kind: /carrousel|carousel/i.test(userText)
          ? "carousel"
          : /vidéo|video/i.test(userText)
          ? "video"
          : "image",
        copyBrief: userText,
      });
      setLastIntent(intent);

      // Récap
      addMessage({
        id: crypto.randomUUID(),
        role: "assistant",
        content: Templates.recapBeforeLaunch(intent),
        createdAt: new Date().toISOString(),
      });

      // Lancement direct (exemple)
      const { orderId } = await enqueue_job({ intent });
      addMessage({
        id: crypto.randomUUID(),
        role: "assistant",
        content: Templates.confirmAfterEnqueue(
          orderId,
          studioLink(orderId),
          libraryLink(intent.brandId)
        ),
        createdAt: new Date().toISOString(),
      });
    },
    [activeBrandId, addMessage]
  );

  // === Hook proprement fermé (pas de virgule orpheline) ===
  useEffect(() => {
    // Exemple: rafraîchir périodiquement (noop pour l’instant)
    // Tu peux ajouter un interval ici si besoin.
  }, [activeBrandId, addMessage, lastIntent]);

  return (
    <div className="p-4 space-y-4">
      <div className="space-y-2">
        {messages.map((m) => (
          <div key={m.id} className={m.role === "user" ? "text-right" : "text-left"}>
            <div className="inline-block rounded-xl px-3 py-2 border">
              <pre className="whitespace-pre-wrap">{m.content}</pre>
            </div>
          </div>
        ))}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          const input = e.currentTarget.elements.namedItem("chat") as HTMLInputElement | null;
          if (!input || !input.value.trim()) return;
          void handleSend(input.value.trim());
          input.value = "";
        }}
        className="flex gap-2"
      >
        <input
          name="chat"
          className="flex-1 border rounded-lg px-3 py-2"
          placeholder="Décris ce que tu veux créer…"
        />
        <button type="submit" className="border rounded-lg px-3 py-2">
          Envoyer
        </button>
      </form>
    </div>
      content: `👋 Hey ! Je suis Alfie, ton assistant créatif.\n\n${welcomeLines}\n\nQu'est-ce que tu veux créer aujourd'hui ?`,
      type: "text",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [pendingIntent, setPendingIntent] = useState<AlfieIntent | null>(null);
  const [lastIntent, setLastIntent] = useState<AlfieIntent | null>(null);
  const [quickReplies, setQuickReplies] = useState<string[]>([]);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [jobs, setJobs] = useState<AlfieJobStatus[]>([]);
  const [assets, setAssets] = useState<LibraryAsset[]>([]);
  const [isSending, setIsSending] = useState(false);

  const brandName = brandKit?.name ?? "ta marque";

  const addMessage = useCallback((message: Message) => {
    const withTimestamp: Message = {
      ...message,
      createdAt: message.createdAt ?? new Date().toISOString(),
    };
    setMessages((current) => [...current, withTimestamp]);
  }, []);

  const handleUserMessage = useCallback(
    async (text: string) => {
      if (!activeBrandId) {
        toast.error("Sélectionne une marque active avant de discuter avec Alfie.");
        return;
      }

      const trimmed = text.trim();
      if (!trimmed) return;

      addMessage({ id: generateId(), role: "user", content: trimmed, createdAt: new Date().toISOString() });
      setInput("");
      setIsSending(true);
  useEffect(() => {
    if (orderTotal > 0) {
      setExpectedTotal(orderTotal);
    }
  }, [orderTotal]);

  useEffect(() => {
    setJobContext(orderId);
  }, [orderId]);

  // Restauration d'état après refresh
  useEffect(() => {
    const restoreSessionState = async () => {
      if (orderId || !user?.id) return;

      try {
        const route = routeUserMessage(trimmed, {
          brandId: activeBrandId,
          baseIntent: lastIntent ?? undefined,
        });

        if (route.kind === "reply") {
          addMessage({
            id: generateId(),
            role: "assistant",
            content: route.text,
            createdAt: new Date().toISOString(),
            quickReplies: route.quickReplies,
          });
          setQuickReplies(route.quickReplies ?? []);
          setPendingIntent(null);
          return;
        }

        setQuickReplies([]);
        setPendingIntent(route.intent);
        setLastIntent(route.intent);
        addMessage({
          id: generateId(),
          role: "assistant",
          content: route.text,
          createdAt: new Date().toISOString(),
        });
      } catch (error) {
        console.error("[AlfieChat] routing failed", error);
        toast.error("Je n'ai pas compris ce brief, reformule-le en précisant le format et l'objectif.");
      } finally {
        setIsSending(false);
      }
    },
    [activeBrandId, addMessage, lastIntent]
  );

  const refreshStatuses = useCallback(
    async (targetOrderId: string) => {
      if (!activeBrandId) return;
      try {
        const payload = await searchAlfieAssets(activeBrandId, targetOrderId);
        setJobs(payload.jobs);
        setAssets(payload.assets);
      } catch (error) {
        console.error("[AlfieChat] status refresh failed", error);
      }
    },
    [activeBrandId]
  );

  useEffect(() => {
    if (!orderId) return;
    refreshStatuses(orderId);
    const interval = setInterval(() => {
      refreshStatuses(orderId);
    }, 5000);
    return () => clearInterval(interval);
  }, [orderId, refreshStatuses]);

  const handleSubmit = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      void handleUserMessage(input);
    },
    [handleUserMessage, input]
    let currentOrder = orderId;

    const channel = supabase
      .channel("job_queue_changes")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "job_queue",
          filter: `order_id=eq.${orderId}`,
        },
        (payload) => {
          if (currentOrder !== orderId) return; // ignorer si l'order a changé
          const job = payload.new as any;

          if (job.status === "completed") {
            const assetUrl =
              job.result?.assetUrl || job.result?.images?.[0] || job.result?.carousels?.[0]?.slides?.[0]?.url;

            if (assetUrl) {
              let type: "image" | "carousel" | "video" = "image";
              let content = "✅ Génération terminée !";

              if (job.type === "render_images") {
                type = "image";
                content = "✅ Image générée !";
              } else if (job.type === "render_carousels") {
                type = "carousel";
                content = "✅ Slide de carrousel générée !";
              } else if (job.type === "generate_video") {
                type = "video";
                content = "✅ Vidéo générée !";
              }

              addMessage({
                role: "assistant",
                content,
                type,
                assetUrl,
                assetId: job.id,
              });

              toast.success(content);
            }
          } else if (job.status === "failed") {
            const errorContent = `❌ Erreur : ${job.error || "Génération échouée"}`;
            addMessage({ role: "assistant", content: errorContent, type: "text" });
            toast.error("Échec de la génération");
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [orderId]);

  // =====================
  // Upload d'image validé
  // =====================
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isImage = file.type.startsWith("image/");
    const isVideo = file.type.startsWith("video/");

    if (isImage && !ALLOWED_IMG.includes(file.type)) {
      toast.error("Format image non supporté (PNG/JPEG/WebP).");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    if (!isImage && !isVideo) {
      toast.error("Format non supporté. Choisis une image ou une vidéo.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    if (isImage && file.size > MAX_IMG_BYTES) {
      toast.error("Image trop lourde (max 10 Mo).");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    if (isVideo && file.size > MAX_VIDEO_BYTES) {
      toast.error("Vidéo trop volumineuse (max 200 Mo).");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setUploadingSource(true);

    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!user) throw new Error("Authentification requise");

      const { signedUrl } = await uploadToChatBucket(file, supabase, user.id);

      const previewUrl = URL.createObjectURL(file);
      clearUploadedSource();
      setUploadedSource({
        url: signedUrl,
        previewUrl,
        type: isVideo ? "video" : "image",
        name: file.name,
      });

      toast.success(isVideo ? "Vidéo importée ! Décris ce que tu veux en faire." : "Image importée ! Décris ce que tu veux en faire.");
    } catch (error: unknown) {
      console.error("[Upload] Error:", error);
      toast.error(
        `Erreur lors de l’upload${error ? ` : ${toErrorMessage(error)}` : ""}`,
      );
    } finally {
      setUploadingSource(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const planCarouselSlides = useCallback(
    async (brief: any) => {
      if (!carouselEnabled) {
        throw new Error("La génération de carrousels est désactivée.");
      }
      if (!brief) throw new Error("Brief carrousel manquant");

      const slideCount = (() => {
        const value =
          typeof brief?.numSlides === "number" ? brief.numSlides : parseInt(String(brief?.numSlides ?? ""), 10);
        return Number.isFinite(value) && value > 0 ? value : 5;
      })();

      const { data, error } = await supabase.functions.invoke("alfie-plan-carousel", {
        body: {
          prompt: brief?.topic || "Carousel",
          slideCount,
          brandKit: brandKit
            ? {
                name: brandKit.name,
                palette: brandKit.palette,
                voice: brandKit.voice,
                niche: brandKit.niche,
              }
            : undefined,
        },
      });
      if (error) throw error;

      const payload = (data as any)?.data ?? data;
      if (payload?.error) throw new Error(String(payload.error));

      const prompts: string[] = Array.isArray(payload?.prompts) ? payload.prompts : [];
      const slides: any[] = Array.isArray(payload?.slides) ? payload.slides : [];

      return slides.map((slide, idx) => ({
        title: slide?.title ?? `Slide ${idx + 1}`,
        subtitle: slide?.subtitle ?? slide?.punchline ?? "",
        bullets: Array.isArray(slide?.bullets) ? slide.bullets : [],
        cta: slide?.cta ?? slide?.cta_primary ?? "",
        prompt: prompts[idx] ?? prompts[0] ?? "",
        type: slide?.type ?? null,
        topic: brief?.topic ?? null,
        angle: brief?.angle ?? null,
        index: idx,
      }));
    },
    [brandKit, carouselEnabled],
  );

  const handleQuickReply = useCallback(
    (reply: string) => {
      void handleUserMessage(reply);
    },
    [handleUserMessage]
  );

  const handleCancelRecap = useCallback(() => {
    setPendingIntent(null);
  }, []);

  const handleConfirmIntent = useCallback(async () => {
    if (!pendingIntent) return;
    if (!activeBrandId) {
      toast.error("Connecte une marque avant de lancer une génération.");
      return;
    }

    try {
      setIsSending(true);
      const result = await enqueueAlfieJob(pendingIntent);
      setOrderId(result.orderId);
      toast.success("Génération lancée ! Suis le statut ci-dessous.");
      setPendingIntent(null);
    const intent = options?.intentOverride ?? detectIntent(trimmed || rawMessage);

    if (!videoEnabled && (options?.forceTool === "generate_video" || intent === "video")) {
      toast.error("La génération vidéo est désactivée dans cet environnement.");
      return;
    }

    if (!carouselEnabled && (options?.forceTool === "render_carousel" || options?.intentOverride === "carousel")) {
      toast.error("La génération de carrousels est désactivée dans cet environnement.");
      return;
    }

    // lock UI
    setIsLoading(true);
    inFlightRef.current = true;

    // push message user
    setInput("");
    addMessage({
      role: "user",
      content: trimmed || (uploadedSource ? "(média uniquement)" : "(message vide)"),
      type: (uploadedSource?.type as Message["type"]) || "text",
      assetUrl: uploadedSource ? uploadedSource.previewUrl || uploadedSource.url : undefined,
      metadata: uploadedSource ? { name: uploadedSource.name, signedUrl: uploadedSource.url } : undefined,
    });

    // Commande /queue (monitoring)
    if (rawMessage.startsWith("/queue")) {
      try {
        const headers = await getAuthHeader();
        const { data, error } = await supabase.functions.invoke("queue-monitor", { headers });
        if (error) throw error;

        interface QueueMonitorResponse {
          counts?: {
            done_24h?: number;
            processing?: number;
            retrying?: number;
            queued?: number;
            error?: number;
            done?: number;
          };
          backlogSeconds?: number;
          stuck?: { runningStuckCount?: number };
        }
        const response = data as QueueMonitorResponse;
        const c = response?.counts || {};
        const oldest = response?.backlogSeconds ?? null;
        const stuck = response?.stuck?.runningStuckCount ?? 0;
        const done24h = c.done_24h ?? 0;
        const minutes = oldest ? Math.max(0, Math.round((oldest as number) / 60)) : null;

        addMessage({
          role: "assistant",
          content: [
            "📊 État de la file de jobs:",
            `• queued: ${c.queued ?? 0}`,
            `• processing: ${c.processing ?? 0}`,
            `• retrying: ${c.retrying ?? 0}`,
            `• errors: ${c.error ?? 0}`,
            `• done (24h): ${done24h}`,
            `• plus ancien en attente: ${minutes !== null ? minutes + " min" : "n/a"}`,
            `• jobs bloqués (>5min): ${stuck}`,
          ].join("\n"),
          type: "text",
        });
      } catch (error: unknown) {
        addMessage({
          role: "assistant",
          content: `❌ Monitoring indisponible: ${toErrorMessage(error)}`,
          type: "text",
        });
      } finally {
        setIsLoading(false);
        inFlightRef.current = false;
      }
      return;
    }

    // Retry orchestrator (3 tentatives)
    const maxRetries = 3;

    let lastError: unknown = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const headers = await getAuthHeader();

        const requestPayload: {
          message: string;
          user_message?: string;
          conversationId?: string;
          brandId: string;
          forceTool?: "generate_video" | "generate_image" | "render_carousel";
          uploadedSourceUrl?: string;
          uploadedSourceType?: UploadedSource["type"];
          prompt?: string;
          slides?: any[];
        } = {
          message: trimmed || rawMessage || "",
          user_message: promptOverride.length > 0 ? promptOverride : trimmed || rawMessage || "",
          brandId: activeBrandId,
        };

        if (conversationId) {
          requestPayload.conversationId = conversationId;
        }

        // intention vidéo
        if (options?.forceTool) {
          requestPayload.forceTool = options.forceTool;
        } else if (intent === "video") {
          requestPayload.forceTool = "generate_video";
        }

        if (promptOverride.length > 0) {
          requestPayload.prompt = promptOverride;
        }

        if (options?.slides && options.slides.length > 0) {
          requestPayload.slides = options.slides;
        }

        if (uploadedSource) {
          requestPayload.uploadedSourceUrl = uploadedSource.url;
          requestPayload.uploadedSourceType = uploadedSource.type;
        }

        const { data, error } = await supabase.functions.invoke("alfie-orchestrator", {
          body: requestPayload,
          headers,
        });
        if (error) throw error;

        const payload = (data ?? null) as OrchestratorResponse | null;

        if (!mountedRef.current) return;

        if (payload?.conversationId) setConversationId(payload.conversationId);

        if (payload?.context) setLastContext(payload.context);

        if (payload?.orderId) {
          setOrderId(payload.orderId);
          setConversationState("generating");

          addMessage({
            role: "assistant",
            content: "🚀 Génération lancée !",
            type: "text",
            links: [
              { label: "Voir dans Studio", href: `/studio?order=${payload.orderId}` },
              { label: "Voir la Bibliothèque", href: `/library?order=${payload.orderId}` },
            ],
          });
        }

        if (typeof payload?.totalSlides === "number") {
          setExpectedTotal(payload.totalSlides);
        }

        if (payload?.state) {
          setConversationState(normalizeConversationState(payload.state));
        }

        if (payload?.response) {
          const quickRepliesRaw =
            Array.isArray(payload.quickReplies) && payload.quickReplies.length > 0 ? payload.quickReplies : undefined;
          const quickReplies = quickRepliesRaw?.filter((reply: unknown) => {
            if (typeof reply !== "string") return false;
            if (!videoEnabled && /vid[ée]o/i.test(reply)) return false;
            if (!carouselEnabled && /carrou?sel/i.test(reply)) return false;
            return true;
          });

          const links = payload?.orderId
            ? [
                { label: "Voir dans Studio", href: `/studio?order=${payload.orderId}` },
                { label: "Voir la Bibliothèque", href: `/library?order=${payload.orderId}` },
              ]
            : undefined;

          addMessage({
            role: "assistant",
            content: payload.response,
            type: "text",
            quickReplies,
            reasoning: payload.reasoning,
            brandAlignment: payload.brandAlignment,
            orderId: payload.orderId ?? null,
            links,
          });
        }

        if (payload?.bulkCarouselData) {
          addMessage({
            role: "assistant",
            content: "📦 Génération en masse terminée !",
            type: "bulk-carousel",
            bulkCarouselData: payload.bulkCarouselData,
          });
        }

        // succès → reset image si envoyée
        if (uploadedSource) clearUploadedSource();

        setIsLoading(false);
        inFlightRef.current = false;
        return;
      } catch (error: unknown) {
        lastError = error;
        console.error(`[Chat] Error (attempt ${attempt}/${maxRetries}):`, error);
        if (attempt < maxRetries) {
          await sleep(backoffMs(attempt));
        }
      }
    }

    // Échec toutes tentatives
    if (mountedRef.current) {
      const errorDetails = lastError ? toErrorMessage(lastError) : "Erreur inconnue";
      addMessage({
        id: generateId(),
        role: "assistant",
        content: `C'est parti ! Tu peux suivre l'avancement depuis le Studio ou la Library.`,
        createdAt: new Date().toISOString(),
      });
      await refreshStatuses(result.orderId);
    } catch (error) {
      console.error("[AlfieChat] enqueue failed", error);
      const message = error instanceof Error ? error.message : "Impossible de lancer la génération.";
      toast.error(message);
    } finally {
      setIsSending(false);
      toast.error(`Échec après 3 tentatives : ${errorDetails}`);
      if (lastError) {
        void captureException(lastError, { brandId: activeBrandId, jobId: orderId });
      }
      setIsLoading(false);
      inFlightRef.current = false;
    }
  }, [activeBrandId, addMessage, pendingIntent, refreshStatuses]);

  const recapLines = useMemo(() => {
    if (!pendingIntent) return [] as string[];
    return [
      `• Format: ${pendingIntent.ratio} — ${pendingIntent.kind}`,
      `• Objectif: ${pendingIntent.goal}`,
      `• Tone: ${pendingIntent.tone_pack}`,
      `• Template: ${pendingIntent.templateId ?? "—"}`,
      `• Contenu: "${pendingIntent.copyBrief}"`,
    ];
  }, [pendingIntent]);

  const hasCompletedAsset = assets.some((asset) => asset.status === "ready" || asset.status === "done");
      if (reply === "Voir la bibliothèque" && orderId) {
        window.open(`/library?order=${orderId}`, "_blank");
        return;
      }

      if (reply === "Oui, lance !" && lastContext) {
        try {
          if (Array.isArray(lastContext.carouselBriefs) && lastContext.carouselBriefs.length > 0) {
            if (!carouselEnabled) {
              toast.error("La génération de carrousels est désactivée dans cet environnement.");
              return;
            }
            const slides = await planCarouselSlides(lastContext.carouselBriefs[0]);
            await handleSend(reply, { forceTool: "render_carousel", slides, intentOverride: "carousel" });
            return;
          }

          if (Array.isArray(lastContext.imageBriefs) && lastContext.imageBriefs.length > 0) {
            const brief = lastContext.imageBriefs[0] || {};
            const parts = [brief.objective, brief.content, brief.style]
              .map((part: unknown) => (typeof part === "string" ? part.trim() : ""))
              .filter((part: string) => part.length > 0);
            const prompt = parts.join(" • ");
            await handleSend(prompt || reply, {
              forceTool: "generate_image",
              promptOverride: prompt || reply,
              intentOverride: "image",
            });
            return;
          }
        } catch (err) {
          console.error("[Chat] Quick reply launch error:", err);
          toast.error(`Impossible de lancer : ${toErrorMessage(err)}`);
          void captureException(err, { brandId: activeBrandId, jobId: orderId });
          return;
        }
      }

      setInput(reply);
      await handleSend(reply);
    },
    [handleSend, isLoading, lastContext, orderId, planCarouselSlides, carouselEnabled, activeBrandId],
  );

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <div className="rounded-lg border p-6">
        <div className="mb-4 space-y-3">
          {messages.map((message) => (
            <div key={message.id} className="space-y-2">
              <div className="text-sm font-semibold text-muted-foreground">
                {message.role === "assistant" ? "Alfie" : "Toi"}
              </div>
              <p className="whitespace-pre-line text-base text-foreground">{message.content}</p>
              {message.quickReplies && message.quickReplies.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {message.quickReplies.map((reply) => (
                    <Button key={reply} size="sm" variant="secondary" onClick={() => handleQuickReply(reply)}>
                      {reply}
                    </Button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <TextareaAutosize
            minRows={2}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder={`Ex: Carrousel 5 slides pour ${brandName}, objectif lead avec CTA "Demander une démo"`}
            className="w-full resize-none rounded-md border bg-background p-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            disabled={isSending}
          />
          <div className="flex justify-end">
            <Button type="submit" disabled={isSending || !input.trim()}>
              Envoyer
            </Button>
          </div>
        </form>
      </div>

      {pendingIntent && (
        <Card>
          <CardHeader>
            <CardTitle>Récap de ta création</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1 text-sm text-muted-foreground">
              {recapLines.map((line) => (
                <p key={line}>{line}</p>
              ))}
            </div>
            <div className="flex gap-3">
              <Button onClick={handleConfirmIntent} disabled={isSending}>
                Oui, lancer
              </Button>
              <Button type="button" variant="outline" onClick={handleCancelRecap} disabled={isSending}>
                Modifier
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {orderId && (
        <StatusPanel
          orderId={orderId}
          jobs={jobs}
          assets={assets}
          hasPreview={hasCompletedAsset}
        />
      )}

      {quickReplies.length > 0 && !pendingIntent && (
        <div className="flex flex-wrap gap-2">
          {quickReplies.map((reply) => (
            <Button key={reply} size="sm" variant="outline" onClick={() => handleQuickReply(reply)}>
              {reply}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}

interface StatusPanelProps {
  orderId: string;
  jobs: AlfieJobStatus[];
  assets: LibraryAsset[];
  hasPreview: boolean;
}

function StatusPanel({ orderId, jobs, assets, hasPreview }: StatusPanelProps) {
  const primaryStatus = jobs[0]?.status ?? "queued";
  const statusLabel = statusToLabel(primaryStatus);
  const studioHref = studioLink(orderId);
  const libraryHref = libraryLink(orderId);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle>Statuts de la génération</CardTitle>
        <Badge variant="outline">{statusLabel}</Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-3">
          <Button variant="secondary" asChild>
            <a href={studioHref} target="_blank" rel="noreferrer">
              Ouvrir Studio
            </a>
          </Button>
          <Button variant="outline" asChild>
            <a href={libraryHref} target="_blank" rel="noreferrer">
              Voir Library
            </a>
          </Button>
        </div>
        <Separator />
        <div className="space-y-3">
          <h4 className="text-sm font-semibold">Historique</h4>
          <div className="space-y-2 text-sm text-muted-foreground">
            {jobs.map((job) => (
              <div key={job.id} className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-foreground">{job.type}</span>
                  <Badge variant="secondary">{statusToLabel(job.status)}</Badge>
                </div>
                {job.errorMessage && <p className="text-destructive">{job.errorMessage}</p>}
                {job.events.slice(0, 3).map((event) => (
                  <p key={event.id} className="text-xs">
                    {new Date(event.createdAt).toLocaleTimeString()} — {event.kind}
                    {event.message ? ` · ${event.message}` : ""}
                  </p>
                ))}
              </div>
            ))}
            {jobs.length === 0 && <p>Aucun job enregistré pour cette commande.</p>}
          </div>
        </div>
        <Separator />
        <div className="space-y-2">
          <h4 className="text-sm font-semibold">Assets générés</h4>
          {hasPreview ? (
            <ul className="space-y-1 text-sm text-muted-foreground">
              {assets.map((asset) => (
                <li key={asset.id}>
                  {asset.kind} — {asset.status} {asset.previewUrl && "·"}{" "}
                  {asset.previewUrl && (
                    <a
                      href={asset.previewUrl}
                      className="text-primary hover:underline"
                      target="_blank"
                      rel="noreferrer"
                    >
                      Prévisualiser
                    </a>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">Aucun média généré pour l'instant.</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function statusToLabel(status: string): string {
  switch (status) {
    case "queued":
    case "pending":
      return "En attente";
    case "processing":
    case "running":
    case "rendering":
      return "En cours";
    case "done":
    case "completed":
    case "succeeded":
      return "Terminé";
    case "failed":
    case "error":
      return "En échec";
    default:
      return status;
  }
}

import React, { useState, useRef, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { Send, ImagePlus, Loader2, Download } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useBrandKit } from "@/hooks/useBrandKit";
import { supabase } from "@/lib/supabase";
import { getAuthHeader } from "@/lib/auth";
import { uploadToChatBucket } from "@/lib/chatUploads";
import { enqueueJob } from "@/lib/jobs";
import { Button } from "@/components/ui/button";
import TextareaAutosize from "react-textarea-autosize";
import { CreateHeader } from "@/components/create/CreateHeader";
import { QuotaBar } from "@/components/create/QuotaBar";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { useLibraryAssetsSubscription } from "@/hooks/useLibraryAssetsSubscription";
import { getAspectClass, type ConversationState, type OrchestratorResponse } from "@/types/chat";
import type { JobQueueType } from "@/lib/types/jobQueue";
import { slideUrl } from "@/lib/cloudinary/imageUrls";
import { extractCloudNameFromUrl } from "@/lib/cloudinary/utils";

// =====================
// Détection d'intention vidéo
// =====================
const VIDEO_KEYWORDS = /\b(vid[ée]o|reel|r[ée]el|tiktok|shorts?|clip)\b/i;

function detectIntent(message: string): "video" | "default" {
  if (VIDEO_KEYWORDS.test(message)) return "video";
  return "default";
}

const normalizeConversationState = (state?: string | null): ConversationState => {
  switch (state) {
    case "generating":
      return "generating";
    case "completed":
      return "completed";
    default:
      return "idle";
  }
};

// =====================
// Helpers robustesse
// =====================

// UUID safe (fallback si randomUUID indisponible)
const safeUuid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? (crypto as Crypto).randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36);

function toErrorMessage(err: unknown) {
  if (err instanceof Error) return err.message;
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}

// Limites & backoff
const MAX_INPUT_LEN = 2000;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const backoffMs = (attempt: number) => {
  const base = 600 * attempt; // 600, 1200, 1800…
  const jitter = Math.floor(Math.random() * 200); // 0–199ms
  return base + jitter;
};

// Upload image: types + taille max (10 Mo)
const ALLOWED_IMG = ["image/png", "image/jpeg", "image/webp"];
const MAX_IMG_BYTES = 10 * 1024 * 1024;
const MAX_VIDEO_BYTES = 200 * 1024 * 1024;

const FORCE_TOOL_TO_JOB_TYPE: Record<NonNullable<SendOptions["forceTool"]>, JobQueueType> = {
  generate_image: "render_images",
  generate_video: "generate_video",
  render_carousel: "render_carousels",
};

type UploadedSource = {
  url: string;
  previewUrl: string;
  type: "image" | "video";
  name: string;
};

// =====================
// TYPES
// =====================
type SendOptions = {
  forceTool?: "generate_video" | "generate_image" | "render_carousel";
  slides?: any[];
  promptOverride?: string;
  intentOverride?: "video" | "image" | "carousel";
};

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  type?: "text" | "image" | "video" | "carousel" | "reasoning" | "bulk-carousel";
  assetUrl?: string;
  assetId?: string;
  metadata?: Record<string, unknown>;
  reasoning?: string;
  brandAlignment?: string;
  quickReplies?: string[];
  links?: Array<{ label: string; href: string }>;
  bulkCarouselData?: {
    carousels: Array<{
      carousel_index: number;
      slides: Array<{
        storage_url: string;
        index: number;
      }>;
      zip_url?: string;
    }>;
    totalCarousels: number;
    slidesPerCarousel: number;
  };
  orderId?: string | null;
  timestamp: Date;
}

// =====================
// COMPOSANT PRINCIPAL
// =====================
export function AlfieChat() {
  const { user } = useAuth();
  const { activeBrandId, brandKit } = useBrandKit();

  // États
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "👋 Hey ! Je suis Alfie, ton assistant créatif.\n\nJe peux créer pour toi :\n• Des **images** percutantes\n• Des **vidéos** engageantes\n• Des **carrousels** complets\n\nQu'est-ce que tu veux créer aujourd'hui ?",
      type: "text",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [uploadedSource, setUploadedSource] = useState<UploadedSource | null>(null);
  const [uploadingSource, setUploadingSource] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [conversationState, setConversationState] = useState<ConversationState>("idle");
  const [expectedTotal, setExpectedTotal] = useState<number | null>(null);
  const [lastContext, setLastContext] = useState<any | null>(null);

  // Subscription aux assets de l'order
  const { assets: orderAssets, total: orderTotal } = useLibraryAssetsSubscription(orderId);

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const seenAssetsRef = useRef(new Set<string>());
  const finishAnnouncedRef = useRef<string | null>(null);
  const mountedRef = useRef(true);
  const inFlightRef = useRef(false);

  const clearUploadedSource = useCallback(() => {
    setUploadedSource((prev) => {
      if (prev?.previewUrl?.startsWith("blob:")) {
        try {
          URL.revokeObjectURL(prev.previewUrl);
        } catch (err) {
          console.warn("[Chat] revoke preview failed", err);
        }
      }
      return null;
    });
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    return () => {
      if (uploadedSource?.previewUrl?.startsWith("blob:")) {
        try {
          URL.revokeObjectURL(uploadedSource.previewUrl);
        } catch (err) {
          console.warn("[Chat] revoke preview cleanup failed", err);
        }
      }
    };
  }, [uploadedSource]);

  useEffect(() => {
    seenAssetsRef.current = new Set<string>();
    finishAnnouncedRef.current = null;
    setExpectedTotal(null);
  }, [orderId]);

  useEffect(() => {
    if (orderTotal > 0) {
      setExpectedTotal(orderTotal);
    }
  }, [orderTotal]);

  // Restauration d'état après refresh
  useEffect(() => {
    const restoreSessionState = async () => {
      if (orderId || !user?.id) return;

      try {
        const { data, error } = await supabase
          .from("alfie_conversation_sessions")
          .select("*")
          .eq("user_id", user.id)
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!error && data?.order_id) {
          setOrderId(data.order_id);
          setConversationId(data.id);
          setConversationState(normalizeConversationState(data.conversation_state));
        }
      } catch (e) {
        console.error("[Chat] restoreSessionState error:", e);
      }
    };

    restoreSessionState();
  }, [user?.id, orderId]);

  // Utils
  const addMessage = (message: Omit<Message, "id" | "timestamp">): string => {
    const id = safeUuid();
    if (!mountedRef.current) return id;
    setMessages((prev) => [
      ...prev,
      {
        ...message,
        id,
        timestamp: new Date(),
      },
    ]);
    return id;
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // System message during generation
  useEffect(() => {
    if (conversationState === "generating" && orderId) {
      const hasGeneratingMessage = messages.some(
        (m) => m.role === "assistant" && m.content.includes("🚀 Génération en cours"),
      );
      if (!hasGeneratingMessage) {
        addMessage({
          role: "assistant",
          content: "🚀 Génération en cours... Je te tiens au courant dès que c'est prêt !",
          type: "text",
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationState, orderId]);

  // Affichage en temps réel des nouveaux assets
  useEffect(() => {
    if (!orderId || !orderAssets.length) return;

    for (const asset of orderAssets) {
      const key = asset.url || asset.id;
      if (!key || seenAssetsRef.current.has(key)) continue;

      seenAssetsRef.current.add(key);

      const isCarouselSlide = asset.type === "carousel_slide";
      addMessage({
        role: "assistant",
        content: isCarouselSlide ? `✅ Slide ${asset.slideIndex + 1} générée !` : "✅ Image générée !",
        type: isCarouselSlide ? "carousel" : "image",
        assetUrl: asset.url,
        metadata: isCarouselSlide ? { assetUrls: [{ url: asset.url, format: asset.format || "4:5" }] } : undefined,
      });
    }

    // Fin de génération (si total connu)
    const targetTotal = expectedTotal ?? orderTotal ?? 0;
    const canAnnounce =
      conversationState === "generating" &&
      targetTotal > 0 &&
      orderAssets.length >= targetTotal &&
      finishAnnouncedRef.current !== orderId;

    if (canAnnounce) {
      setConversationState("completed");
      finishAnnouncedRef.current = orderId;
      addMessage({
        role: "assistant",
        content: "🎉 Génération terminée ! Tes visuels sont prêts dans la Bibliothèque.",
        quickReplies: ["Voir la bibliothèque", "Créer un nouveau visuel"],
        type: "text",
      });
    }

    // Fallback si total inconnu
    if (
      conversationState === "generating" &&
      orderAssets.length > 0 &&
      !targetTotal &&
      finishAnnouncedRef.current !== orderId
    ) {
      finishAnnouncedRef.current = orderId;
      addMessage({
        role: "assistant",
        content: "📦 Des visuels ont été générés ! Retrouve-les dans la Bibliothèque.",
        quickReplies: ["Voir la bibliothèque"],
        type: "text",
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderAssets, orderId, conversationState, orderTotal, expectedTotal]);

  // Realtime job monitoring (avec garde si l'order change)
  useEffect(() => {
    if (!orderId) return;
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
    [brandKit],
  );

  // =====================
  // Handler principal (orchestrator + retry)
  // =====================
  const handleSend = async (override?: string, options?: SendOptions) => {
    if (isLoading || inFlightRef.current) return;

    if (uploadingSource) {
      toast.error("Upload en cours. Patiente quelques secondes avant d’envoyer.");
      return;
    }

    const rawMessage = (override ?? input).trim();
    const promptOverride = options?.promptOverride ? options.promptOverride.trim() : "";
    const baseMessage = promptOverride.length > 0 ? promptOverride : rawMessage;
    const trimmed = baseMessage.slice(0, MAX_INPUT_LEN);

    if (!trimmed && !uploadedSource) return;
    if (!activeBrandId) {
      toast.error("Sélectionne une marque d'abord !");
      return;
    }

    const intent = options?.intentOverride ?? detectIntent(trimmed || rawMessage);

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
            completed_24h?: number;
            pending?: number;
            running?: number;
            queued?: number;
            failed?: number;
          };
          backlogSeconds?: number;
          stuck?: { runningStuckCount?: number };
        }
        const response = data as QueueMonitorResponse;
        const c = response?.counts || {};
        const oldest = response?.backlogSeconds ?? null;
        const stuck = response?.stuck?.runningStuckCount ?? 0;
        const completed24h = c.completed_24h ?? 0;
        const minutes = oldest ? Math.max(0, Math.round((oldest as number) / 60)) : null;

        addMessage({
          role: "assistant",
          content: [
            "📊 État de la file de jobs:",
            `• queued: ${c.queued ?? 0}`,
            `• running: ${c.running ?? 0}`,
            `• failed: ${c.failed ?? 0}`,
            `• completed (24h): ${completed24h}`,
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
          const quickReplies =
            Array.isArray(payload.quickReplies) && payload.quickReplies.length > 0 ? payload.quickReplies : undefined;

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

        if (payload?.orderId) {
          const forceTool = requestPayload.forceTool ?? options?.forceTool;
          let jobType: JobQueueType | null = null;

          if (forceTool && FORCE_TOOL_TO_JOB_TYPE[forceTool]) {
            jobType = FORCE_TOOL_TO_JOB_TYPE[forceTool];
          } else if (options?.intentOverride === "carousel" || intent === "carousel") {
            jobType = "render_carousels";
          } else if (options?.intentOverride === "video" || intent === "video") {
            jobType = "generate_video";
          } else if (options?.intentOverride === "image") {
            jobType = "render_images";
          } else {
            jobType = "render_images";
          }

          if (jobType) {
            const jobPayload: Record<string, unknown> = {
              message: trimmed || rawMessage || "",
            };

            if (requestPayload.prompt) jobPayload.prompt = requestPayload.prompt;
            if (requestPayload.slides) jobPayload.slides = requestPayload.slides;
            if (requestPayload.uploadedSourceUrl) jobPayload.uploadedSourceUrl = requestPayload.uploadedSourceUrl;
            if (requestPayload.uploadedSourceType) jobPayload.uploadedSourceType = requestPayload.uploadedSourceType;
            if (uploadedSource?.previewUrl) jobPayload.previewUrl = uploadedSource.previewUrl;
            if (uploadedSource?.url) jobPayload.sourceUrl = uploadedSource.url;
            if (forceTool) jobPayload.forceTool = forceTool;

            try {
              await enqueueJob({
                type: jobType,
                order_id: payload.orderId,
                brand_id: activeBrandId ?? null,
                payload: jobPayload,
              });
            } catch (enqueueError) {
              console.error('[Chat] enqueueJob failed:', enqueueError);
            }
          }
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
        console.error(`[Chat] Error (attempt ${attempt}/${maxRetries}):`, error);
        if (attempt < maxRetries) {
          await sleep(backoffMs(attempt));
        }
      }
    }

    // Échec toutes tentatives
    if (mountedRef.current) {
      addMessage({
        role: "assistant",
        content: "❌ Impossible de lancer la génération après plusieurs tentatives. Réessaie dans quelques instants.",
        type: "text",
      });
      toast.error("Échec après 3 tentatives");
      setIsLoading(false);
      inFlightRef.current = false;
    }
  };

  const handleQuickReplyClick = useCallback(
    async (reply: string) => {
      if (isLoading || inFlightRef.current) return;

      if (reply === "Voir la bibliothèque" && orderId) {
        window.open(`/library?order=${orderId}`, "_blank");
        return;
      }

      if (reply === "Oui, lance !" && lastContext) {
        try {
          if (Array.isArray(lastContext.carouselBriefs) && lastContext.carouselBriefs.length > 0) {
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
          return;
        }
      }

      setInput(reply);
      await handleSend(reply);
    },
    [handleSend, isLoading, lastContext, orderId, planCarouselSlides],
  );

  // =====================
  // Rendu
  // =====================
  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <CreateHeader />

      {/* Quota Bar */}
      {activeBrandId && <QuotaBar activeBrandId={activeBrandId} />}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <div key={message.id} className={`flex gap-3 ${message.role === "user" ? "justify-end" : "justify-start"}`}>
            {message.role === "assistant" && (
              <Avatar className="h-8 w-8 border-2 border-primary">
                <AvatarFallback className="bg-primary text-primary-foreground">🐾</AvatarFallback>
              </Avatar>
            )}

            <div
              className={`max-w-[70%] rounded-lg p-3 ${
                message.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"
              }`}
            >
              {/* Message texte */}
              {(!message.type || message.type === "text") && (
                <div className="space-y-2">
                  <p className="whitespace-pre-wrap text-sm">{message.content}</p>

                  {/* Reasoning */}
                  {message.reasoning && (
                    <div className="bg-purple-50 dark:bg-purple-900/20 p-3 rounded-lg mt-2 text-sm border border-purple-200 dark:border-purple-800">
                      <div className="flex items-start gap-2">
                        <span className="text-lg">💡</span>
                        <div className="flex-1">
                          <p className="font-semibold text-purple-900 dark:text-purple-100 mb-1">
                            Pourquoi ce choix créatif ?
                          </p>
                          <p className="text-purple-700 dark:text-purple-300 text-xs leading-relaxed">
                            {message.reasoning}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Alignement Brand Kit */}
                  {message.brandAlignment && (
                    <div className="bg-emerald-50 dark:bg-emerald-900/20 p-3 rounded-lg mt-2 text-sm border border-emerald-200 dark:border-emerald-800">
                      <div className="flex items-start gap-2">
                        <span className="text-lg">🎨</span>
                        <div className="flex-1">
                          <p className="font-semibold text-emerald-900 dark:text-emerald-100 mb-1">
                            Cohérence Brand Kit
                          </p>
                          <p className="text-emerald-700 dark:text-emerald-300 text-xs leading-relaxed">
                            {message.brandAlignment}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {message.quickReplies && message.quickReplies.length > 0 && (
                    <div className="mt-2">
                      <div className="flex flex-wrap gap-2">
                        {message.quickReplies.map((reply, idx) => (
                          <Button
                            key={idx}
                            variant="outline"
                            size="sm"
                            disabled={isLoading}
                            onClick={() => {
                              void handleQuickReplyClick(reply);
                            }}
                            className="text-xs"
                          >
                            {reply}
                          </Button>
                        ))}
                      </div>
                    </div>
                  )}

                  {message.orderId && (!message.links || message.links.length === 0) && (
                    <div className="mt-3">
                      <Button asChild variant="link" className="px-0">
                        <a href={`/studio?order=${message.orderId}`}>Voir dans Studio →</a>
                      </Button>
                    </div>
                  )}

                  {message.links && message.links.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {message.links.map((link, linkIdx) => (
                        <Button key={linkIdx} asChild variant="link" className="px-0 text-xs">
                          <a href={link.href} target="_blank" rel="noreferrer">
                            {link.label} →
                          </a>
                        </Button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Message image */}
              {message.type === "image" && message.assetUrl && (
                <div className="space-y-2">
                  <p className="text-sm">{message.content}</p>
                  <img src={message.assetUrl} alt="Generated" className="rounded-lg w-full" />

                  {/* Reasoning pour images */}
                  {message.reasoning && (
                    <div className="bg-purple-50 dark:bg-purple-900/20 p-3 rounded-lg text-sm border border-purple-200 dark:border-purple-800">
                      <div className="flex items-start gap-2">
                        <span className="text-lg">💡</span>
                        <div className="flex-1">
                          <p className="font-semibold text-purple-900 dark:text-purple-100 mb-1">
                            Direction artistique
                          </p>
                          <p className="text-purple-700 dark:text-purple-300 text-xs leading-relaxed">
                            {message.reasoning}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Message vidéo */}
              {message.type === "video" && (
                <div className="space-y-2">
                  <p className="text-sm">{message.content}</p>
                  {message.assetUrl && <video src={message.assetUrl} controls className="rounded-lg w-full" />}
                  {message.metadata?.status === "processing" && <Loader2 className="h-4 w-4 animate-spin" />}
                </div>
              )}

              {/* Message carrousel */}
              {message.type === "carousel" && (
                <div className="space-y-2">
                  <p className="text-sm">{message.content}</p>
                  {message.metadata?.total && message.metadata?.done ? (
                    <Progress value={(Number(message.metadata.done) / Number(message.metadata.total)) * 100} className="w-full" />
                  ) : null}
                  {message.metadata?.assetUrls && Array.isArray(message.metadata.assetUrls) ? (
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      {message.metadata.assetUrls.map((entry: any, i: number) => (
                          <img
                            key={i}
                            src={typeof entry === 'string' ? entry : entry.url}
                            alt={`Asset ${i + 1}`}
                            className="rounded-lg w-full"
                          />
                        ))}
                    </div>
                  ) : null}
                </div>
              )}

              {/* Message bulk carrousel */}
              {message.type === "bulk-carousel" && message.bulkCarouselData && (
                <div className="space-y-4 mt-4">
                  {message.bulkCarouselData.carousels.map((carousel: any, idx: number) => (
                    <div key={idx} className="border border-border rounded-lg p-4 bg-card">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="font-semibold text-lg">
                          Carrousel {carousel.carousel_index}/{message.bulkCarouselData!.totalCarousels}
                        </h3>
                        {carousel.zip_url && (
                          <Button size="sm" onClick={() => window.open(carousel.zip_url, "_blank")} className="gap-2">
                            <Download className="w-4 h-4" />
                            Télécharger ZIP
                          </Button>
                        )}
                      </div>

                      {/* Aperçu principal (1re slide + overlays si dispo) */}
                      {carousel.slides?.[0] && (
                        <div className="mb-3 rounded-lg overflow-hidden border border-border">
                          <img
                            src={(() => {
                              const firstSlide = carousel.slides[0];
                              if (firstSlide.cloudinary_public_id && firstSlide.text_json) {
                                const cloudName =
                                  extractCloudNameFromUrl(firstSlide.cloudinary_url) ||
                                  (import.meta.env.VITE_CLOUDINARY_CLOUD_NAME as string | undefined);

                                if (!cloudName) {
                                  return firstSlide.cloudinary_url || firstSlide.storage_url;
                                }

                                try {
                                  return slideUrl(firstSlide.cloudinary_public_id, {
                                    title: firstSlide.text_json.title,
                                    subtitle: firstSlide.text_json.subtitle,
                                    bulletPoints: firstSlide.text_json.bullets,
                                    aspectRatio: firstSlide.format || "4:5",
                                    cloudName,
                                  });
                                } catch {
                                  return firstSlide.cloudinary_url || firstSlide.storage_url;
                                }
                              }
                              return firstSlide.cloudinary_url || firstSlide.storage_url;
                            })()}
                            alt={`Aperçu carrousel ${carousel.carousel_index}`}
                            className="w-full object-cover"
                            onError={(e) => {
                              const firstSlide = carousel.slides[0];
                              if (firstSlide.cloudinary_url?.startsWith("https://")) {
                                (e.currentTarget as HTMLImageElement).src = firstSlide.cloudinary_url;
                              }
                            }}
                          />
                        </div>
                      )}

                      {/* Grille de vignettes */}
                      <div className="grid grid-cols-5 gap-2">
                        {carousel.slides?.slice(0, 5).map((slide: any, slideIdx: number) => {
                          const aspectClass = getAspectClass(slide.format || "4:5");

                          const thumbUrl = (() => {
                            if (slide.cloudinary_public_id && slide.text_json) {
                              const cloudName =
                                extractCloudNameFromUrl(slide.cloudinary_url) ||
                                (import.meta.env.VITE_CLOUDINARY_CLOUD_NAME as string | undefined);

                              if (!cloudName) {
                                return slide.cloudinary_url || slide.storage_url;
                              }

                              try {
                                return slideUrl(slide.cloudinary_public_id, {
                                  title: slide.text_json.title,
                                  subtitle: slide.text_json.subtitle,
                                  bulletPoints: slide.text_json.bullets,
                                  aspectRatio: slide.format || "4:5",
                                  cloudName,
                                });
                              } catch {
                                return slide.cloudinary_url || slide.storage_url;
                              }
                            }
                            return slide.cloudinary_url || slide.storage_url;
                          })();

                          return (
                            <div
                              key={slideIdx}
                              className={`relative ${aspectClass} rounded overflow-hidden border border-border`}
                            >
                              <img
                                src={thumbUrl}
                                alt={`Slide ${slideIdx + 1}`}
                                className="absolute inset-0 w-full h-full object-cover"
                                loading="lazy"
                                onError={(e) => {
                                  if (
                                    slide.cloudinary_url &&
                                    (e.currentTarget as HTMLImageElement).src !== slide.cloudinary_url
                                  ) {
                                    (e.currentTarget as HTMLImageElement).src = slide.cloudinary_url;
                                  } else if (
                                    slide.storage_url &&
                                    (e.currentTarget as HTMLImageElement).src !== slide.storage_url
                                  ) {
                                    (e.currentTarget as HTMLImageElement).src = slide.storage_url;
                                  }
                                }}
                              />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {message.role === "user" && (
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-secondary text-secondary-foreground">
                  {user?.email?.charAt(0).toUpperCase() || "U"}
                </AvatarFallback>
              </Avatar>
            )}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Composer */}
      <div className="border-t bg-background p-4">
        {uploadedSource && (
          <div className="mb-2 relative inline-block">
            {uploadedSource.type === "image" ? (
              <img
                src={uploadedSource.previewUrl || uploadedSource.url}
                alt="Média uploadé"
                className="h-20 rounded-lg border object-cover"
              />
            ) : (
              <video
                src={uploadedSource.previewUrl || uploadedSource.url}
                className="h-20 rounded-lg border object-cover"
                muted
                loop
                playsInline
              />
            )}
            <Button
              size="sm"
              variant="destructive"
              className="absolute -top-2 -right-2 h-6 w-6 rounded-full p-0"
              onClick={clearUploadedSource}
              aria-label="Retirer le média"
              title="Retirer le média"
            >
              <span aria-hidden>×</span>
            </Button>
          </div>
        )}

        <div className="flex gap-2 items-end">
          <input type="file" ref={fileInputRef} className="hidden" accept="image/*,video/*" onChange={handleFileUpload} />

          <Button
            variant="outline"
            size="icon"
            onClick={() => fileInputRef.current?.click()}
            disabled={isLoading || uploadingSource}
            aria-label="Importer un média"
            title="Importer un média"
          >
            {uploadingSource ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
          </Button>

          <TextareaAutosize
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              // Enter sans Shift OU Ctrl/Cmd+Enter => envoyer
              if ((e.key === "Enter" && !e.shiftKey) || ((e.metaKey || e.ctrlKey) && e.key === "Enter")) {
                e.preventDefault();
                void handleSend();
              }
            }}
            placeholder="Décris ce que tu veux créer..."
            className="flex-1 resize-none rounded-lg border bg-background px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            minRows={1}
            maxRows={5}
            disabled={isLoading}
          />

          <Button
            onClick={() => void handleSend()}
            disabled={isLoading || uploadingSource || (!input.trim() && !uploadedSource)}
            size="icon"
            aria-label="Envoyer"
            title="Envoyer"
          >
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}

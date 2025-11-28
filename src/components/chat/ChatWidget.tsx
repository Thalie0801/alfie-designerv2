import { useMemo, useState, useRef, useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { MessageCircle, X, RefreshCw } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useBrief, type Brief } from "@/hooks/useBrief";
import { useAuth } from "@/hooks/useAuth";
import { detectContentIntent, detectPlatformHelp } from "@/lib/chat/detect";
import { chooseCarouselOutline, chooseImageVariant, chooseVideoVariant } from "@/lib/chat/coachPresets";
import { whatCanDoBlocks } from "@/lib/chat/helpMap";
import type { AlfiePack, AlfieWidgetResponse } from "@/types/alfiePack";
import PackPreviewCard from "./PackPreviewCard";
import PackPreparationModal from "./PackPreparationModal";
import { supabase } from "@/integrations/supabase/client";

type CoachMode = "strategy" | "da" | "maker";
type ChatMessage = { role: "user" | "assistant"; node: ReactNode };
type AssistantReply = ChatMessage;

type ContentIntent = ReturnType<typeof detectContentIntent>;

export default function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [msgs, setMsgs] = useState<ChatMessage[]>([]);
  const [modeCoach, setModeCoach] = useState<CoachMode>("strategy");
  const [seed, setSeed] = useState(0);
  const [pendingPack, setPendingPack] = useState<AlfiePack | null>(null);
  const [showPackModal, setShowPackModal] = useState(false);

  const brief = useBrief();
  const { profile } = useAuth();
  const navigate = useNavigate();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll quand les messages changent
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs]);

  const BRAND = useMemo(
    () =>
      ({
        mint: "#90E3C2",
        mintDark: "#66C9A6",
        light: "#F5F5F5",
        text: "#000000",
        grayBorder: "#e5e7eb",
        ink: "#1f2937",
      }) as const,
    [],
  );

  const disabled =
    (typeof window !== "undefined" &&
      (new URLSearchParams(window.location.search).get("chat") === "off" ||
        localStorage.getItem("alfie_chat") === "off")) ||
    false;
  if (disabled) return null;

  const coachModes: CoachMode[] = ["strategy", "da", "maker"];

  const chip = (label: string, onClick: () => void) => (
    <button
      key={label}
      onClick={onClick}
      className="border rounded-full px-3 py-1 text-xs hover:bg-gray-50"
      style={{ borderColor: BRAND.grayBorder }}
    >
      {label}
    </button>
  );

  const navBtn = (href: string, label: string) => (
    <a
      key={label}
      href={href}
      className="inline-block mr-2 mb-2 px-3 py-2 rounded-md text-sm font-medium hover:bg-gray-50"
      style={{
        background: "#ffffff",
        border: `1px solid ${BRAND.grayBorder}`,
        color: BRAND.ink,
      }}
    >
      {label}
    </a>
  );

  const primaryBtn = (label: string, onClick: () => void) => (
    <button
      onClick={onClick}
      type="button"
      className="inline-block mt-1 px-3 py-2 rounded-md text-sm font-medium text-white"
      style={{ background: `linear-gradient(135deg, ${BRAND.mint}, ${BRAND.mintDark})` }}
    >
      {label}
    </button>
  );

  // --------- AEDITUS ---------

  function getAeditusUrl(): string {
    return "https://aeditus.com";
  }

  function isNoIdeaMessage(raw: string): boolean {
    const text = raw.toLowerCase();
    return (
      text.includes("pas d'idée") ||
      text.includes("pas d’idée") ||
      text.includes("aucune idée") ||
      text.includes("plus d'idée") ||
      text.includes("plus d’idée") ||
      text.includes("je n'ai pas d'idée") ||
      text.includes("je ne sais pas quoi poster")
    );
  }

  // Fonction pour détecter un message de confirmation
  function isConfirmationMessage(raw: string): boolean {
    const text = raw.toLowerCase().trim();
    return /^(ok|oui|c'est bon|on y va|lance|parfait|go|génère|crée|d'accord|da)/i.test(text);
  }

  const assistantCard = (content: ReactNode, showPrefillButton: boolean = false) => (
    <div className="space-y-2">
      <div className="space-y-2 bg-white rounded-lg p-3 border" style={{ borderColor: BRAND.grayBorder }}>
        {content}
      </div>
      {showPrefillButton && <div className="pt-1">{primaryBtn("Pré-remplir Studio", prefillStudio)}</div>}
    </div>
  );

  const buildAeditusReply = (): AssistantReply => {
    const url = getAeditusUrl();

    return {
      role: "assistant" as const,
      node: assistantCard(
        <div className="space-y-2 text-sm">
          <p>
            Tu es en panne d’idées ? 💡 <strong>Aeditus</strong> peut prendre le relais.
          </p>
          <p>
            Aeditus, c’est <strong>1 mois de contenu complet</strong> dans ta niche : idées, structures, textes… Tu n’as
            plus qu’à valider, planifier, et tu peux même remplacer les visuels par des images générées avec Alfie.
          </p>
          <p>
            Résultat : tu gardes la main sur ton image de marque, sans avoir à réfléchir tous les jours à “qu’est-ce que
            je poste ?”.
          </p>
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="inline-block mt-1 px-3 py-2 rounded-md text-sm font-medium text-white"
            style={{
              background: `linear-gradient(135deg, ${BRAND.mint}, ${BRAND.mintDark})`,
            }}
          >
            Découvrir Aeditus
          </a>
        </div>,
      ),
    };
  };

  // --------- BRIEF / INTENT ---------

  const sanitizeBriefPatch = (patch: Partial<Brief>) => {
    const next: Partial<Brief> = { ...patch };

    if (typeof next.slides === "number") {
      const clamped = Math.max(1, Math.min(10, Math.trunc(next.slides)));
      next.slides = Number.isNaN(clamped) ? undefined : clamped;
    }

    for (const key of Object.keys(next) as (keyof Brief)[]) {
      if (next[key] === undefined) {
        delete next[key];
      }
    }

    return next;
  };

  const applyIntent = (raw: string) => {
    const intent = detectContentIntent(raw);
    const desiredFormat = (intent.explicitMode ? intent.mode : (brief.state.format ?? intent.mode)) as Brief["format"];

    const patch: Partial<Brief> = {
      platform: (intent.platform || brief.state.platform) as Brief["platform"],
      format: desiredFormat,
      ratio: intent.ratio ?? brief.state.ratio,
      tone: intent.tone || brief.state.tone,
      slides: intent.slides ?? brief.state.slides,
      topic: intent.topic ?? brief.state.topic,
      cta: intent.cta ?? brief.state.cta,
    };

    const sanitised = sanitizeBriefPatch(patch);
    const mergedBrief = { ...brief.state, ...sanitised } as Brief;

    brief.merge(sanitised);

    return { intent, mergedBrief };
  };

  // registerIdeas supprimé - géré par le LLM

  const buildNeedTopicReply = (): AssistantReply => {
    const suggestions = [
      "Carrousel 5 slides 4:5 Instagram : 3 erreurs en pub Meta pour PME",
      "Visuel 1:1 LinkedIn : annonce webinar IA marketing",
      "Vidéo 9:16 TikTok : astuces Canva pour solopreneurs",
    ];

    return {
      role: "assistant" as const,
      node: (
        <div className="space-y-3">
          <p className="text-sm">
            Donne-moi un <strong>sujet précis</strong>. Exemples :
          </p>
          <div className="flex flex-wrap gap-2">{suggestions.map((s) => chip(s, () => setInput(s)))}</div>
        </div>
      ),
    };
  };

  const buildLocalReply = (intent: ContentIntent, mergedBrief: Brief): AssistantReply => {
    const format = mergedBrief.format ?? (intent.explicitMode ? intent.mode : "image");
    const ratio = mergedBrief.ratio ?? intent.ratio;
    const platform = mergedBrief.platform ?? intent.platform ?? undefined;
    const tone = mergedBrief.tone ?? intent.tone ?? undefined;
    const topic = mergedBrief.topic ?? intent.topic ?? "";
    const cta = mergedBrief.cta ?? intent.cta ?? undefined;
    const slides = mergedBrief.slides ?? intent.slides ?? 5;

    const formatLabel = format === "carousel" ? "Carrousel" : format === "video" ? "Vidéo" : "Visuel";

    const header =
      modeCoach === "strategy" ? (
        <p className="text-sm">
          <strong>{formatLabel}</strong> — ratio <strong>{ratio}</strong>
          {platform ? (
            <>
              {" "}
              — <strong>{platform}</strong>
            </>
          ) : null}
          {tone ? (
            <>
              {" "}
              — ton <strong>{tone}</strong>
            </>
          ) : null}
          .
        </p>
      ) : modeCoach === "da" ? (
        <p className="text-sm">
          <strong>Direction créative</strong> pour « {topic || "ton sujet"} »
        </p>
      ) : (
        <p className="text-sm">
          <strong>Prêt à produire</strong> — je te pré-remplis Studio.
        </p>
      );

    let body: ReactNode;
    const collectedIdeas: string[] = [];

    if (format === "carousel") {
      const count = typeof slides === "number" ? slides : 5;
      const plan = chooseCarouselOutline(count, seed);
      setSeed((v) => v + 1);
      const title = topic ? `Carrousel — ${topic}` : `Carrousel — ${plan.title}`;
      collectedIdeas.push(title);
      body = (
        <div className="space-y-2 text-sm">
          <p>
            Thème : <em>{topic || "Ton sujet"}</em>
          </p>
          <div>
            <p className="font-medium">Structure suggérée : {plan.title}</p>
            <ul className="list-disc ml-5">
              {plan.slides.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
          </div>
        </div>
      );
    } else {
      const variant =
        format === "video"
          ? chooseVideoVariant({ topic: topic || undefined, cta }, seed)
          : chooseImageVariant({ topic: topic || undefined, cta }, seed);
      setSeed((v) => v + 1);
      const ideaLabel = format === "video" ? "Vidéo" : "Visuel";
      if (topic) {
        collectedIdeas.push(`${ideaLabel} — ${topic}`);
      }
      body = variant;
    }

    // Ideas tracking géré par le LLM maintenant

    return {
      role: "assistant" as const,
      node: assistantCard(
        <div className="space-y-2">
          {header}
          {body}
        </div>,
        true, // Afficher le bouton "Pré-remplir Studio" pour les suggestions locales
      ),
    };
  };

  // --------- PREFILL STUDIO ---------

  function prefillStudio() {
    const data = JSON.stringify(brief.state);
    try {
      sessionStorage.setItem("alfie_prefill_brief", data);
    } catch {
      // ignore
    }

    const params = new URLSearchParams();
    params.set("mode", brief.state.format || "image");
    if (brief.state.ratio) params.set("ratio", brief.state.ratio);
    if (brief.state.slides) params.set("slides", String(brief.state.slides));
    if (brief.state.topic) params.set("topic", brief.state.topic);
    if (brief.state.cta) params.set("cta", brief.state.cta);

    const url = `/studio?${params.toString()}`;
    navigate(url, {
      state: {
        prefillPrompt: brief.state.topic,
        prefillBrief: brief.state,
      },
    });
  }

  // --------- ROUTAGE PLATEFORME ---------

  function replyPlatform(raw: string): AssistantReply | null {
    const plat = detectPlatformHelp(raw);
    if (plat.matches.length > 0) {
      return {
        role: "assistant" as const,
        node: (
          <div className="space-y-2">
            <p className="text-sm">Accès rapide :</p>
            <div className="pt-1">{plat.matches.map((m) => navBtn(m.to, m.label))}</div>
          </div>
        ),
      };
    }
    if (plat.isWhatCanDo) {
      const blocks = whatCanDoBlocks();
      return { role: "assistant" as const, node: blocks };
    }
    return null;
  }

  // --------- LOGIQUE AI PRINCIPALE ---------

  // Mapping des personas pour alfie-chat-widget
  const personaMap = {
    strategy: "coach",
    da: "da_junior",
    maker: "realisateur_studio",
  } as const;

  async function replyContentWithAI(raw: string): Promise<AssistantReply> {
    const { intent, mergedBrief } = applyIntent(raw);

    if (intent.needTopic && !mergedBrief.topic) {
      return buildNeedTopicReply();
    }

    const activeBrandId = profile?.active_brand_id;
    if (!activeBrandId) {
      console.warn("No active brand ID, falling back to local reply");
      return buildLocalReply(intent, mergedBrief);
    }

    // Construire l'historique des messages pour le LLM
    const chatHistory = msgs
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m) => ({
        role: m.role,
        content: typeof m.node === "string" ? m.node : raw, // Simplification
      }));

    // Ajouter le message utilisateur actuel
    chatHistory.push({
      role: "user",
      content: raw,
    });

    try {
      // Récupérer les Woofs restants
      let woofsRemaining: number | undefined;
      try {
        const { data: quotaData } = await supabase.functions.invoke("get-quota", {
          body: { brandId: activeBrandId },
        });
        if (quotaData?.woofs_remaining !== undefined) {
          woofsRemaining = quotaData.woofs_remaining;
        }
      } catch (quotaError) {
        console.warn("Could not fetch Woofs quota:", quotaError);
      }

      // Appeler alfie-chat-widget avec le contexte Woofs
      const response = await supabase.functions.invoke("alfie-chat-widget", {
        body: {
          brandId: activeBrandId,
          persona: personaMap[modeCoach],
          messages: chatHistory,
          lang: "fr",
          woofsRemaining,
        },
      });

      if (response.error) {
        console.error("alfie-chat-widget error:", response.error);
        return buildLocalReply(intent, mergedBrief);
      }

      const { reply, pack } = response.data as AlfieWidgetResponse;

      if (!reply) {
        return buildLocalReply(intent, mergedBrief);
      }

      // Si un pack est détecté, le stocker
      if (pack) {
        console.log("Pack détecté:", pack);
        setPendingPack(pack);
      }

      // Ideas tracking géré par le LLM maintenant

      const blocks = reply
        .split(/\n{2,}/)
        .map((block) => block.trim())
        .filter((block) => block.length > 0);

      const paragraphs = blocks.map((block, index) => (
        <p key={index} className="text-sm whitespace-pre-line">
          {block}
        </p>
      ));

      return {
        role: "assistant" as const,
        node: assistantCard(
          <div className="space-y-2">
            {paragraphs}
            {pack && activeBrandId && (
              <PackPreviewCard pack={pack} onOpenDetail={() => setShowPackModal(true)} />
            )}
          </div>,
          false, // Ne pas afficher "Pré-remplir Studio" quand il y a un pack (le pack a sa propre action)
        ),
      };
    } catch (error) {
      console.error("alfie-chat-widget: unexpected error", error);
      return buildLocalReply(intent, mergedBrief);
    }
  }

  async function makeReply(raw: string): Promise<AssistantReply | null> {
    const cleaned = raw.trim();
    if (!cleaned) return null;

    if (isNoIdeaMessage(cleaned)) {
      return buildAeditusReply();
    }

    const concierge = replyPlatform(cleaned);
    if (concierge) return concierge;

    return await replyContentWithAI(cleaned);
  }

  // --------- UI / ENVOI ---------

  function pushUser(text: string) {
    setMsgs((m) => [
      ...m,
      {
        role: "user",
        node: (
          <span
            className="inline-block rounded-2xl px-3 py-2 text-sm bg-white border"
            style={{ borderColor: BRAND.grayBorder }}
          >
            {text}
          </span>
        ),
      },
    ]);
  }

  async function handleSend() {
    const text = input.trim();
    if (!text) return;
    setInput("");
    pushUser(text);
    
    // Si c'est un message de confirmation et qu'un pack est en attente, ouvrir le modal
    if (isConfirmationMessage(text) && pendingPack) {
      setShowPackModal(true);
      return;
    }
    
    const reply = await makeReply(text);
    if (reply) setMsgs((m) => [...m, reply]);
  }

  // Fonction pour réinitialiser la conversation
  function resetConversation() {
    setMsgs([]);
    setPendingPack(null);
    setInput("");
  }

  // Fonction pour changer de mode et réinitialiser
  function handleModeChange(mode: CoachMode) {
    console.log(`🎨 Changing mode from ${modeCoach} to ${mode}`);
    setModeCoach(mode);
    resetConversation();
    console.log("✓ Conversation reset complete");
  }

  const portalTarget = typeof document !== "undefined" ? document.body : null;
  if (!portalTarget) return null;

  return createPortal(
    <>
      {!open && (
        <button
          data-tour-id="chat-widget-bubble"
          onClick={() => setOpen(true)}
          className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 rounded-full shadow-lg w-12 h-12 sm:w-14 sm:h-14 grid place-items-center hover:scale-105 transition z-[9998]"
          style={{
            background: `linear-gradient(135deg, ${BRAND.mint}, ${BRAND.mintDark})`,
            color: "white",
          }}
          aria-label="Ouvrir Alfie Chat"
        >
          <MessageCircle className="w-5 h-5 sm:w-6 sm:h-6" />
        </button>
      )}

      {/* Modal de préparation du pack */}
      {showPackModal && pendingPack && profile?.active_brand_id && (
        <PackPreparationModal
          pack={pendingPack}
          brandId={profile.active_brand_id}
          onClose={() => setShowPackModal(false)}
        />
      )}

      {open && (
        <div
          className="fixed bottom-2 right-2 left-2 sm:bottom-6 sm:right-6 sm:left-auto w-auto sm:w-[400px] h-[calc(100vh-120px)] sm:h-[580px] max-h-[90vh] rounded-2xl shadow-2xl border flex flex-col z-[9999]"
          style={{
            background: BRAND.light,
            borderColor: BRAND.grayBorder,
          }}
        >
          <div
            className="flex items-center justify-between p-3 border-b"
            style={{
              background: `${BRAND.mint}22`,
              borderColor: BRAND.grayBorder,
            }}
          >
            <div className="font-medium" style={{ color: BRAND.text }}>
              Alfie Chat (coach & DA)
            </div>
            <div className="flex items-center gap-2">
              {msgs.length > 0 && (
                <button
                  onClick={resetConversation}
                  className="p-2 rounded hover:bg-white/50"
                  style={{ color: BRAND.text }}
                  aria-label="Nouvelle conversation"
                  title="Nouvelle conversation"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className="p-2 rounded hover:bg-white/50"
                style={{ color: BRAND.text }}
                aria-label="Fermer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="px-3 py-2 flex gap-2">
            {coachModes.map((m) => (
              <button
                key={m}
                onClick={() => handleModeChange(m)}
                className={`px-3 py-1 rounded-full text-xs border transition-all duration-200 ${modeCoach === m ? "font-semibold scale-105" : "hover:scale-102"}`}
                style={{
                  borderColor: BRAND.grayBorder,
                  background: modeCoach === m ? `${BRAND.mint}33` : "white",
                }}
              >
                {m === "strategy" ? "Coach Stratégie" : m === "da" ? "DA junior" : "Réalisateur Studio"}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-auto p-3 space-y-2" style={{ color: BRAND.ink }}>
            {msgs.length === 0 ? (
              <p className="text-sm">
                {modeCoach === "strategy"
                  ? "Je suis ton Coach Stratégie. Dis-moi ce que tu veux créer et on définit ensemble la meilleure approche 💡"
                  : modeCoach === "da"
                  ? "Je suis ton DA junior. Décris-moi ton projet et je t'aide à trouver la direction créative idéale 🎨"
                  : "Je suis ton Réalisateur Studio. Dis-moi ton objectif et je te prépare un pack complet prêt à lancer 🎬"}
              </p>
            ) : (
              msgs.map((m, i) => (
                <div key={i} className={m.role === "user" ? "text-right" : "text-left"}>
                  {m.node}
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          {msgs.length === 0 && (
            <div className="px-3 pb-2">
              <div className="flex flex-wrap gap-2">
                {chip("Que peut faire Alfie ?", () => setInput("Que peut faire Alfie ?"))}
                {chip("Où gérer mon abonnement ?", () => setInput("Où gérer mon abonnement ?"))}
                {chip("Carrousel Instagram", () =>
                  setInput("Carrousel 5 slides 4:5 Instagram : 3 idées Reels pour PME"),
                )}
                {chip("Vidéo TikTok", () => setInput("Vidéo 9:16 TikTok : astuces Canva"))}
              </div>
            </div>
          )}

          <div className="p-3 border-t flex gap-2" style={{ borderColor: BRAND.grayBorder }}>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void handleSend();
                }
              }}
              className="flex-1 rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
              style={{ borderColor: BRAND.grayBorder }}
              placeholder="Pose une question…"
            />
            <button
              onClick={() => void handleSend()}
              className="px-3 py-2 rounded-md text-sm font-medium text-white disabled:opacity-50"
              style={{
                background: `linear-gradient(135deg, ${BRAND.mint}, ${BRAND.mintDark})`,
              }}
              disabled={!input.trim()}
            >
              Envoyer
            </button>
          </div>
        </div>
      )}
    </>,
    portalTarget,
  );
}

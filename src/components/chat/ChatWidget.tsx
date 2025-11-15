import { useMemo, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { MessageCircle, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useBrief, type Brief } from "@/hooks/useBrief";
import { useBrandKit } from "@/hooks/useBrandKit";
import { detectContentIntent, detectPlatformHelp } from "@/lib/chat/detect";
import { chooseCarouselOutline, chooseImageVariant, chooseVideoVariant } from "@/lib/chat/coachPresets";
import { whatCanDoBlocks } from "@/lib/chat/helpMap";
import { createMediaOrder } from "@/features/studio/studioApi";
import type { CreateMediaOrderInput } from "@/features/studio/studioApi";

type CoachMode = "strategy" | "da" | "maker";
type ChatMessage = { role: "user" | "assistant"; node: ReactNode };
type AssistantReply = ChatMessage;

type ChatAIResponse = {
  ok: boolean;
  data?: { message?: string };
  error?: string;
};

export default function ChatWidget() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [msgs, setMsgs] = useState<ChatMessage[]>([]);
  const [modeCoach, setModeCoach] = useState<CoachMode>("strategy");
  const [seed, setSeed] = useState(0);

  const brief = useBrief();
  const { brandKit, activeBrandId } = useBrandKit();
  const [isGeneratingVideo, setIsGeneratingVideo] = useState(false);

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

  const chip = (label: string, onClick: () => void, disabled = false) => (
    <button
      key={label}
      onClick={onClick}
      type="button"
      disabled={disabled}
      className="border rounded-full px-3 py-1 text-xs hover:bg-gray-50 disabled:opacity-60 disabled:cursor-not-allowed"
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
      style={{ background: "#ffffff", border: `1px solid ${BRAND.grayBorder}`, color: BRAND.ink }}
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
    window.location.assign(url);
  }

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

  const pushAssistant = (node: ReactNode) => {
    setMsgs((m) => [...m, { role: "assistant", node }]);
  };

  const buildErrorReply = (message?: string): AssistantReply => ({
    role: "assistant" as const,
    node: (
      <div className="space-y-2 bg-white rounded-lg p-3 border" style={{ borderColor: BRAND.grayBorder }}>
        <p className="text-sm">{message ?? "Oups, je n'ai pas réussi à traiter ta demande. Réessaie plus tard."}</p>
      </div>
    ),
  });

  function replyContent(raw: string): AssistantReply {
    const it = detectContentIntent(raw);

    brief.merge({
      platform: (it.platform || brief.state.platform) as Brief["platform"],
      format: it.mode,
      ratio: it.ratio,
      tone: it.tone || brief.state.tone,
      slides: it.slides ?? brief.state.slides,
      topic: it.topic || brief.state.topic,
      cta: it.cta || brief.state.cta,
    });

    if (!it.topic) {
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
    }

    const next = () => setSeed((v) => v + 1);
    const header =
      modeCoach === "strategy" ? (
        <p>
          <strong>{it.mode === "carousel" ? "Carrousel" : it.mode === "video" ? "Vidéo" : "Visuel"}</strong> — ratio{" "}
          <strong>{it.ratio}</strong>
          {it.platform ? (
            <>
              {" "}
              — <strong>{it.platform}</strong>
            </>
          ) : null}
          {it.tone ? (
            <>
              {" "}
              — ton <strong>{it.tone}</strong>
            </>
          ) : null}
          .
        </p>
      ) : modeCoach === "da" ? (
        <p>
          <strong>Direction créative</strong> pour &quot;{it.topic}&quot;
        </p>
      ) : (
        <p>
          <strong>Prêt à produire</strong> — je te pré-remplis Studio.
        </p>
      );

    let body: ReactNode = null;

    if (it.mode === "carousel") {
      const slides = it.slides ?? 5;
      const plan = chooseCarouselOutline(slides, seed);
      next();
      body = (
        <>
          <p className="text-sm">
            Thème : <em>{it.topic}</em>
          </p>
          <div className="text-sm">
            <p className="font-medium">Structure suggérée : {plan.title}</p>
            <ul className="list-disc ml-5">
              {plan.slides.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
          </div>
        </>
      );
    } else {
      const v =
        it.mode === "video"
          ? chooseVideoVariant({ topic: it.topic ?? undefined, cta: it.cta ?? undefined }, seed)
          : chooseImageVariant({ topic: it.topic ?? undefined, cta: it.cta ?? undefined }, seed);
      next();
      body = v;
    }

    return {
      role: "assistant" as const,
      node: (
        <div className="space-y-2">
          {header}
          {body}
          <div className="pt-1">{primaryBtn("Pré-remplir Studio", prefillStudio)}</div>
        </div>
      ),
    };
  }

  async function replyContentWithAI(raw: string): Promise<AssistantReply> {
    const it = detectContentIntent(raw);

    brief.merge({
      platform: it.platform || brief.state.platform,
      format: it.mode,
      ratio: it.ratio,
      tone: it.tone || brief.state.tone,
      slides: it.slides ?? brief.state.slides,
      topic: it.topic || brief.state.topic,
      cta: it.cta || brief.state.cta,
    });

    if (!it.topic) {
      return replyContent(raw);
    }

    let clearThinking: (() => void) | undefined;
    const showThinking = () => {
      pushAssistant(
        <span
          className="inline-block rounded-2xl px-3 py-2 text-sm bg-white border"
          style={{ borderColor: BRAND.grayBorder }}
        >
          ⏳ Alfie réfléchit...
        </span>,
      );
      return () => setMsgs((prev) => prev.slice(0, -1));
    };

    try {
      clearThinking = showThinking();
      const { data, error } = await supabase.functions.invoke<ChatAIResponse>("chat-ai-assistant", {
        body: {
          message: raw,
          context: {
            contentType: it.mode,
            platform: it.platform,
            brief: brief.state,
            brandKit,
          },
        },
      });

      if (clearThinking) {
        clearThinking();
        clearThinking = undefined;
      }

      if (error) {
        console.error("chat-ai-assistant invoke error", error);
        return buildErrorReply(error.message);
      }

      if (!data?.ok) {
        console.error("chat-ai-assistant response error", data?.error);
        return buildErrorReply(data?.error);
      }

      const aiResponse = data.data?.message || "Je peux t'aider à créer ce contenu !";

      return {
        role: "assistant" as const,
        node: (
          <div className="space-y-2 bg-white rounded-lg p-3 border" style={{ borderColor: BRAND.grayBorder }}>
            <p className="text-sm whitespace-pre-wrap">{aiResponse}</p>
            <div className="flex gap-2 pt-2 flex-wrap">
              {primaryBtn("Créer maintenant →", prefillStudio)}
              <button
                onClick={() => {
                  const newPrompt = `${it.mode} ${it.ratio} ${it.platform || ""} : ${it.topic}`.trim();
                  setInput(newPrompt);
                }}
                type="button"
                className="px-3 py-2 text-sm border rounded-md hover:bg-gray-50"
                style={{ borderColor: BRAND.grayBorder }}
              >
                Affiner
              </button>
            </div>
          </div>
        ),
      };
    } catch (error) {
      console.error("AI response error:", error);
      if (clearThinking) clearThinking();
      return replyContent(raw);
    }
  }

  async function makeReply(raw: string): Promise<AssistantReply | null> {
    const concierge = replyPlatform(raw);
    if (concierge) return concierge;
    return await replyContentWithAI(raw);
  }

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

  async function handleCreateVideoFromChat(promptOverride?: string) {
    if (isGeneratingVideo) return;
    setIsGeneratingVideo(true);
    try {
      const brandId = activeBrandId ?? null;
      const prompt =
        promptOverride?.trim() || input.trim() || "Vidéo TikTok courte pour ma marque";

      const request: CreateMediaOrderInput = {
        kind: "video",
        prompt,
        brandId,
        aspectRatio: "9:16",
        durationSec: 15,
      };

      const { orderId } = await createMediaOrder(request);
      if (!orderId)
        throw new Error("Aucun orderId retourné par la génération vidéo.");

      pushAssistant(
        <div
          className="space-y-2 bg-white rounded-lg p-3 border"
          style={{ borderColor: BRAND.grayBorder }}
        >
          <p className="text-sm whitespace-pre-wrap">
            Parfait, je lance ta vidéo TikTok dans le Studio 🎬{"\n"}
            Je t’ouvre la page pour suivre la génération.
          </p>
        </div>,
      );

      navigate(`/studio?order=${orderId}`);
    } catch (error) {
      console.error(error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Impossible de lancer la vidéo depuis le chat.",
      );
    } finally {
      setIsGeneratingVideo(false);
    }
  }

  async function handleSend() {
    const text = input.trim();
    if (!text) return;
    setInput("");
    pushUser(text);
    const reply = await makeReply(text);
    if (reply) setMsgs((m) => [...m, reply]);
  }

  const portalTarget = typeof document !== "undefined" ? document.body : null;
  if (!portalTarget) return null;

  return createPortal(
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 rounded-full shadow-lg w-14 h-14 grid place-items-center hover:scale-105 transition"
          style={{
            background: `linear-gradient(135deg, ${BRAND.mint}, ${BRAND.mintDark})`,
            color: "white",
            zIndex: 9999,
          }}
          aria-label="Ouvrir Alfie Chat"
        >
          <MessageCircle className="w-6 h-6" />
        </button>
      )}

      {open && (
        <div
          className="fixed bottom-6 right-6 w-[360px] max-w-[95vw] h-[520px] rounded-2xl shadow-2xl border flex flex-col"
          style={{ background: BRAND.light, borderColor: BRAND.grayBorder, zIndex: 9999 }}
        >
          <div
            className="flex items-center justify-between p-3 border-b"
            style={{ background: `${BRAND.mint}22`, borderColor: BRAND.grayBorder }}
          >
            <div className="font-medium" style={{ color: BRAND.text }}>
              Alfie Chat (coach & DA)
            </div>
            <button
              onClick={() => setOpen(false)}
              className="p-2 rounded hover:bg-white/50"
              style={{ color: BRAND.text }}
              aria-label="Fermer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="px-3 py-2 flex gap-2">
            {coachModes.map((m) => (
              <button
                key={m}
                onClick={() => setModeCoach(m)}
                className={`px-3 py-1 rounded-full text-xs border ${modeCoach === m ? "font-semibold" : ""}`}
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
              <p className="text-sm">Pose-moi une question sur tes visuels, formats, idées… Je te guide ✨</p>
            ) : (
              msgs.map((m, i) => (
                <div key={i} className={m.role === "user" ? "text-right" : "text-left"}>
                  {m.node}
                </div>
              ))
            )}
          </div>

          {msgs.length === 0 && (
            <div className="px-3 pb-2">
              <div className="flex flex-wrap gap-2">
                {chip("Que peut faire Alfie ?", () => setInput("Que peut faire Alfie ?"))}
                {chip("Où gérer mon abonnement ?", () => setInput("Où gérer mon abonnement ?"))}
                {chip("Carrousel Instagram", () =>
                  setInput("Carrousel 5 slides 4:5 Instagram : 3 idées Reels pour PME"),
                )}
                {chip(
                  "Vidéo TikTok",
                  () => void handleCreateVideoFromChat("Vidéo 9:16 TikTok : astuces Canva"),
                  isGeneratingVideo,
                )}
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
              style={{ background: `linear-gradient(135deg, ${BRAND.mint}, ${BRAND.mintDark})` }}
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

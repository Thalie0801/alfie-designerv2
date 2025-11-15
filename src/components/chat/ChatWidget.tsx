import { useMemo, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { MessageCircle, X } from "lucide-react";
import { useBrief, type Brief } from "@/hooks/useBrief";
import { useBrandKit } from "@/hooks/useBrandKit";
import { detectContentIntent, detectPlatformHelp } from "@/lib/chat/detect";
import { chooseCarouselOutline, chooseImageVariant, chooseVideoVariant } from "@/lib/chat/coachPresets";
import { whatCanDoBlocks } from "@/lib/chat/helpMap";

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
  const [previousIdeas, setPreviousIdeas] = useState<string[]>([]);

  const brief = useBrief();
  const { brandKit } = useBrandKit();

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

  const assistantCard = (content: ReactNode) => (
    <div className="space-y-2">
      <div className="space-y-2 bg-white rounded-lg p-3 border" style={{ borderColor: BRAND.grayBorder }}>
        {content}
      </div>
      <div className="pt-1">{primaryBtn("Pré-remplir Studio", prefillStudio)}</div>
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

  const registerIdeas = (ideas: string[]) => {
    setPreviousIdeas((prev) => {
      const next = [...prev];
      const seen = new Set(prev);
      for (const idea of ideas) {
        const normalised = idea.trim().replace(/\s+/g, " ");
        if (!normalised || seen.has(normalised)) continue;
        seen.add(normalised);
        next.push(normalised);
      }
      return next;
    });
  };

  function extractInterestingLines(text: string): string[] {
    const lines = text
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    const matches: string[] = [];

    const allowLine = (line: string) => !/^ok,? sur changement d['’]angle/i.test(line);

    for (const line of lines) {
      if (!allowLine(line)) continue;
      const cleaned = line.replace(/^[-•*+]\s*/, "");

      if (
        /^(carrousel|carousel|vid[ée]o|video|image|visuel)/i.test(cleaned) ||
        /^th[eè]me\s*[:–-]/i.test(cleaned) ||
        /^hook\s*[:–-]/i.test(cleaned) ||
        /^id[ée]e?\s*\d*\s*[:–-]/i.test(cleaned)
      ) {
        matches.push(cleaned);
      }

      if (matches.length >= 3) break;
    }

    if (matches.length === 0) {
      const fallback = lines.find((line) => allowLine(line));
      if (fallback) {
        matches.push(fallback.replace(/^[-•*+]\s*/, ""));
      }
    }

    return matches;
  }

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

    if (collectedIdeas.length > 0) {
      registerIdeas(collectedIdeas);
    }

    return {
      role: "assistant" as const,
      node: assistantCard(
        <div className="space-y-2">
          {header}
          {body}
        </div>,
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
    window.location.assign(url);
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

  async function replyContentWithAI(raw: string): Promise<AssistantReply> {
    const { intent, mergedBrief } = applyIntent(raw);

    if (intent.needTopic && !mergedBrief.topic) {
      return buildNeedTopicReply();
    }

    const contextPayload: Record<string, unknown> = {
      mode: modeCoach,
      brief: mergedBrief,
    };

    if (mergedBrief.format) contextPayload.contentType = mergedBrief.format;
    if (mergedBrief.platform) contextPayload.platform = mergedBrief.platform;
    if (brandKit) contextPayload.brandKit = brandKit;

    try {
      const res = await fetch("/functions/v1/chat-ai-assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: raw,
          context: contextPayload,
          previousIdeas,
        }),
      });

      if (!res.ok) {
        console.error("chat-ai-assistant: provider error", res.status, await res.text().catch(() => ""));
        return buildLocalReply(intent, mergedBrief);
      }

      const payload = (await res.json().catch(() => null)) as { data?: { message?: string } } | null;
      const aiMessage = typeof payload?.data?.message === "string" ? payload.data.message.trim() : "";

      if (!aiMessage) {
        return buildLocalReply(intent, mergedBrief);
      }

      registerIdeas(extractInterestingLines(aiMessage));

      const blocks = aiMessage
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
        node: assistantCard(<div className="space-y-2">{paragraphs}</div>),
      };
    } catch (error) {
      console.error("chat-ai-assistant: unexpected error", error);
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
          style={{
            background: BRAND.light,
            borderColor: BRAND.grayBorder,
            zIndex: 9999,
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

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
import { IntentPanel } from "./IntentPanel";
import { supabase } from "@/integrations/supabase/client";
import { sendPackToGenerator, InsufficientWoofsError } from "@/services/generatorFromChat";
import { useOrderCompletion } from "@/hooks/useOrderCompletion";
import { toast } from "sonner";
import { AssetEditDialog } from "@/components/studio/AssetEditDialog";
import type { PackAsset } from "@/types/alfiePack";

type ChatMessage = { role: "user" | "assistant"; node: ReactNode; text?: string };
type AssistantReply = ChatMessage;

type ContentIntent = ReturnType<typeof detectContentIntent>;

/**
 * Enrichit un pack avec woofCostType et count par défaut pour éviter NaN dans les calculs
 */
function enrichPackWithWoofCostType(pack: AlfiePack): AlfiePack {
  return {
    ...pack,
    assets: pack.assets.map(asset => ({
      ...asset,
      count: asset.kind === 'carousel' ? 5 : (asset.count || 1), // Carrousels = toujours 5 slides
      woofCostType: asset.kind === 'carousel' 
        ? 'carousel' // 10 Woofs fixe par carrousel
        : asset.kind === 'image'
        ? 'image'
        : 'video_premium',
    })),
  };
}

/**
 * Parse le bloc <alfie-learn> depuis la réponse pour extraire les termes à apprendre
 */
function parseAlfieLearnBlock(text: string): { term: string; definition: string; template?: any } | null {
  const startTag = '<alfie-learn>';
  const endTag = '</alfie-learn>';
  
  const startIdx = text.toLowerCase().indexOf(startTag.toLowerCase());
  if (startIdx === -1) return null;
  
  const endIdx = text.toLowerCase().indexOf(endTag.toLowerCase(), startIdx);
  if (endIdx === -1) return null;
  
  const jsonContent = text.slice(startIdx + startTag.length, endIdx).trim();
  
  try {
    return JSON.parse(jsonContent);
  } catch {
    console.warn("Failed to parse alfie-learn block:", jsonContent.substring(0, 100));
    return null;
  }
}

/**
 * Nettoie le texte en retirant le bloc <alfie-learn>
 */
function cleanAlfieLearnBlock(text: string): string {
  const startTag = '<alfie-learn>';
  const endTag = '</alfie-learn>';
  
  const startIdx = text.toLowerCase().indexOf(startTag.toLowerCase());
  if (startIdx === -1) return text;
  
  const endIdx = text.toLowerCase().indexOf(endTag.toLowerCase(), startIdx);
  if (endIdx === -1) return text.slice(0, startIdx);
  
  return (text.slice(0, startIdx) + text.slice(endIdx + endTag.length)).trim();
}

export default function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [msgs, setMsgs] = useState<ChatMessage[]>([]);
  const [seed, setSeed] = useState(0);
  const [pendingPack, setPendingPack] = useState<AlfiePack | null>(null);
  const [showPackModal, setShowPackModal] = useState(false);
  const [showIntentPanel, setShowIntentPanel] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [editingAsset, setEditingAsset] = useState<any | null>(null);

  const brief = useBrief();
  const { profile } = useAuth();
  const navigate = useNavigate();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Suivi de complétion des orders
  const { trackOrders } = useOrderCompletion();

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

  // Fonction pour détecter un message de confirmation (vs nouvelle demande de contenu)
  function isConfirmationMessage(raw: string): boolean {
    const text = raw.toLowerCase().trim();
    
    // Si le message contient une demande de contenu, ce n'est PAS une confirmation
    const contentKeywords = /(vidéo|video|carrousel|carousel|image|visuel|slides?|reel|story|post|créer?|génère)/;
    if (contentKeywords.test(text) && text.length > 15) {
      return false; // Nouvelle demande, pas une simple confirmation
    }
    
    // Confirmation simple : "ok", "oui", "lance", etc. (courts et sans demande de contenu)
    return /^(ok|oui|c'est bon|on y va|lance|parfait|go|d'accord|da)[\s!.,]*$/i.test(text);
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
    const replyText = "Tu es en panne d'idées ? 💡 Aeditus peut prendre le relais avec 1 mois de contenu complet.";

    return {
      role: "assistant" as const,
      text: replyText,
      node: assistantCard(
        <div className="space-y-2 text-sm">
          <p>
            Tu es en panne d'idées ? 💡 <strong>Aeditus</strong> peut prendre le relais.
          </p>
          <p>
            Aeditus, c'est <strong>1 mois de contenu complet</strong> dans ta niche : idées, structures, textes… Tu n'as
            plus qu'à valider, planifier, et tu peux même remplacer les visuels par des images générées avec Alfie.
          </p>
          <p>
            Résultat : tu gardes la main sur ton image de marque, sans avoir à réfléchir tous les jours à "qu'est-ce que
            je poste ?".
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
    const replyText = "Donne-moi un sujet précis pour que je puisse t'aider.";

    return {
      role: "assistant" as const,
      text: replyText,
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

    const header = (
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

    const localReplyText = `Suggestion ${formatLabel} — ${topic || 'sujet'}`;
    
    return {
      role: "assistant" as const,
      text: localReplyText,
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
        text: "Accès rapide vers les sections de l'app.",
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
      return { role: "assistant" as const, text: "Voici ce que je peux faire pour toi.", node: blocks };
    }
    return null;
  }

  // --------- LOGIQUE AI PRINCIPALE ---------

  // Fonction pour parser plusieurs packs dans une réponse brute
  // Utilise indexOf/slice au lieu de regex pour un parsing robuste du JSON imbriqué
  function parseMultipleIntents(raw: string): AlfiePack[] {
    const packs: AlfiePack[] = [];
    const startTag = '<alfie-pack>';
    const endTag = '</alfie-pack>';
    let searchStart = 0;
    
    while (true) {
      const startIdx = raw.toLowerCase().indexOf(startTag.toLowerCase(), searchStart);
      if (startIdx === -1) break;
      
      const endIdx = raw.toLowerCase().indexOf(endTag.toLowerCase(), startIdx);
      if (endIdx === -1) break;
      
      const jsonContent = raw.slice(startIdx + startTag.length, endIdx).trim();
      
      try {
        const parsed = JSON.parse(jsonContent);
        if (parsed.assets?.length > 0) {
          console.log("📦 Frontend pack parsed, assets:", parsed.assets.length);
          packs.push(parsed as AlfiePack);
        }
      } catch (e) {
        console.warn("Failed to parse pack in frontend:", e, "Preview:", jsonContent.substring(0, 200));
      }
      
      searchStart = endIdx + endTag.length;
    }
    
    return packs;
  }

  
  /**
   * Construit un pack de fallback quand le LLM ne renvoie pas <alfie-pack>
   * mais que la demande utilisateur est clairement une demande de contenu
   */
  function buildFallbackPack(userMessage: string, mergedBrief: Brief): AlfiePack | null {
    const text = userMessage.toLowerCase();
    
    // Détecter le format
    const isVideo = /(vidéo|video|reel|clip)/i.test(text);
    const isCarousel = /(carrousel|carousel|slides?)/i.test(text);
    
    // Détecter le nombre d'assets
    const countMatch = text.match(/(\d+)\s*(assets?|clips?|scènes?|scenes?|visuels?|images?)/i);
    let assetCount = countMatch ? Math.min(10, Math.max(1, parseInt(countMatch[1]))) : 1;
    
    // Pour les carrousels, le count est le nombre de slides, pas d'assets
    if (isCarousel) {
      assetCount = 1; // 1 carrousel avec N slides
    }
    
    // Construire le format et le kind
    const kind = isVideo ? 'video_premium' : isCarousel ? 'carousel' : 'image';
    
    // Utiliser les valeurs du brief ou des valeurs par défaut
    const ratio = mergedBrief.ratio || (isVideo ? '9:16' : '4:5');
    const platform = mergedBrief.platform || 'instagram';
    const tone = mergedBrief.tone || 'professionnel';
    const topic = mergedBrief.topic || userMessage.substring(0, 100);
    
    // Générer un ID unique pour le groupe de cohérence
    const coherenceGroup = `fallback-${Date.now()}`;
    
    // Créer les assets (on omet woofCostType et brandId car enrichPackWithWoofCostType les ajoutera)
    const assets: any[] = [];
    
    for (let i = 0; i < assetCount; i++) {
      assets.push({
        id: `fallback-${Date.now()}-${i}`,
        kind: kind,
        title: assetCount > 1 ? `${isVideo ? 'Clip' : 'Visuel'} ${i + 1}` : (topic || 'Contenu'),
        prompt: topic || userMessage,
        ratio: ratio,
        platform: platform,
        tone: tone,
        goal: 'engagement',
        count: isCarousel ? (mergedBrief.slides || 5) : 1,
        durationSeconds: isVideo ? 8 : undefined,
        coherenceGroup: assetCount > 1 ? coherenceGroup : undefined,
        scriptGroup: assetCount > 1 ? coherenceGroup : undefined,
        brandId: profile?.active_brand_id || '',
        engine: isVideo ? 'veo_3_1' : undefined,
        withAudio: isVideo ? true : undefined, // ✅ AUDIO ON par défaut pour Veo 3.1
      });
    }
    
    if (assets.length === 0) return null;
    
    return {
      title: `Pack ${kind === 'video_premium' ? 'vidéo' : kind === 'carousel' ? 'carrousel' : 'image'} - ${topic?.substring(0, 30) || 'Contenu'}`,
      summary: userMessage.substring(0, 200),
      assets: assets as PackAsset[],
    };
  }

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
      .filter((m) => m.text) // Seulement les messages avec texte brut
      .map((m) => ({
        role: m.role,
        content: m.text!,
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

      // Appeler alfie-chat-widget avec le contexte Woofs et le plan utilisateur
      const response = await supabase.functions.invoke("alfie-chat-widget", {
        body: {
          brandId: activeBrandId,
          persona: "assistant",
          messages: chatHistory,
          lang: "fr",
          woofsRemaining,
          brief: brief.state,
          userPlan: profile?.plan || 'starter', // ✅ Plan utilisateur pour sélection du modèle IA
        },
      });

      if (response.error) {
        console.error("alfie-chat-widget error:", response.error);
        return buildLocalReply(intent, mergedBrief);
      }

      const { reply, pack, rawReply } = response.data as AlfieWidgetResponse & { rawReply?: string };

      if (!reply) {
        return buildLocalReply(intent, mergedBrief);
      }

      // ✅ DÉTECTION DE PROMESSE NON TENUE : pack annoncé mais absent
      const promisesPack = /(voici le pack|je te propose|voici ta|voilà le pack|prêt à générer)/i.test(reply);
      const hasContentRequest = /(carrousel|carousel|image|images|visuel|vidéo|video)/i.test(raw);
      const hasPackTag = rawReply?.toLowerCase().includes('<alfie-pack>') || reply.toLowerCase().includes('<alfie-pack>');
      
      console.log("📦 Frontend received: pack=", pack ? `${pack.assets?.length} assets` : "null", 
        "| hasPackTag:", hasPackTag, "| rawReplyLength:", rawReply?.length || 0);
      
      if (promisesPack && !pack && hasContentRequest) {
        console.warn("⚠️ AI promised a pack but none was generated, hasPackTag:", hasPackTag);
        
        // ✅ Si le tag existe mais pas de pack → problème de parsing
        if (hasPackTag) {
          toast.error("Oups ! J'ai préparé ton pack mais il y a eu un souci technique. Réessaie !");
        } else {
          toast.error("Oups ! Une erreur s'est produite. Essaie de reformuler ta demande avec plus de détails.");
        }
      }

      // ✅ MULTI-INTENT PARSING : Supporter plusieurs packs dans la réponse
      let finalPack: AlfiePack | null = null;
      
      if (pack) {
        // Pack déjà parsé par l'edge function
        finalPack = pack;
      } else if (rawReply) {
        // ✅ FALLBACK: Chercher des packs dans rawReply (meilleur que reply nettoyé)
        const parsedPacks = parseMultipleIntents(rawReply);
        if (parsedPacks.length > 0) {
          console.log("📦 Frontend fallback parsing succeeded:", parsedPacks.length, "packs");
          // Fusionner tous les packs en un seul
          finalPack = {
            title: parsedPacks.length === 1 
              ? parsedPacks[0].title 
              : `Pack combiné (${parsedPacks.reduce((sum, p) => sum + p.assets.length, 0)} assets)`,
            summary: parsedPacks.map(p => p.summary).join(' + '),
            assets: parsedPacks.flatMap(p => p.assets),
          };
        }
      }
      
      // Fallback sur reply si rawReply pas dispo
      if (!finalPack) {
        const parsedFromReply = parseMultipleIntents(reply);
        if (parsedFromReply.length > 0) {
          finalPack = {
            title: parsedFromReply.length === 1 
              ? parsedFromReply[0].title 
              : `Pack combiné (${parsedFromReply.reduce((sum, p) => sum + p.assets.length, 0)} assets)`,
            summary: parsedFromReply.map(p => p.summary).join(' + '),
            assets: parsedFromReply.flatMap(p => p.assets),
          };
        }
      }

      // ✅ FALLBACK PACK BUILDER: Si toujours pas de pack mais demande de contenu claire
      if (!finalPack && hasContentRequest) {
        console.log("🔧 Building fallback pack from user request");
        finalPack = buildFallbackPack(raw, mergedBrief);
        if (finalPack) {
          toast.info("Pack construit à partir de ta demande ✅");
        }
      }

      if (finalPack) {
        console.log("Pack détecté:", finalPack);
        
        // ✅ Auto-enrichir avec woofCostType pour éviter NaN
        const enrichedPack = enrichPackWithWoofCostType(finalPack);
        setPendingPack(enrichedPack);
        
        // ✅ Mode contrôlé : ouvrir IntentPanel pour plusieurs assets
        if (enrichedPack.assets.length > 1) {
          setShowIntentPanel(true);
        }
      }

      // ✅ Détecter et traiter les blocs <alfie-learn> pour l'apprentissage de termes
      const learnedTerm = parseAlfieLearnBlock(reply);
      if (learnedTerm && activeBrandId) {
        // Sauvegarder le terme appris via edge function
        try {
          const { error: learnError } = await supabase.functions.invoke("alfie-learn-term", {
            body: { brandId: activeBrandId, term: learnedTerm },
          });
          if (!learnError) {
            toast.success(`J'ai appris le terme "${learnedTerm.term}" !`);
          }
        } catch (e) {
          console.warn("Failed to save learned term:", e);
        }
      }

      // ✅ Nettoyage défensif : retirer tout résidu <alfie-pack> et <alfie-learn> avant affichage
      let displayReply = cleanAlfieLearnBlock(reply);
      const packStartIdx = displayReply.toLowerCase().indexOf('<alfie-pack>');
      if (packStartIdx !== -1) {
        const packEndIdx = displayReply.toLowerCase().indexOf('</alfie-pack>', packStartIdx);
        if (packEndIdx !== -1) {
          // Bloc complet → supprimer
          displayReply = displayReply.slice(0, packStartIdx) + displayReply.slice(packEndIdx + '</alfie-pack>'.length);
        } else {
          // Bloc tronqué → supprimer tout depuis <alfie-pack>
          displayReply = displayReply.slice(0, packStartIdx);
        }
      }
      displayReply = displayReply.trim();

      const blocks = displayReply
        .split(/\n{2,}/)
        .map((block) => block.trim())
        .filter((block) => block.length > 0);

      const paragraphs = blocks.map((block, index) => (
        <p key={index} className="text-sm whitespace-pre-line">
          {block}
        </p>
      ));

      // Enrichir le pack pour l'affichage si nécessaire
      const enrichedPackForDisplay = finalPack ? enrichPackWithWoofCostType(finalPack) : null;

      return {
        role: "assistant" as const,
        text: reply,
        node: assistantCard(
          <div className="space-y-2">
            {paragraphs}
            {enrichedPackForDisplay && activeBrandId && (
              <PackPreviewCard pack={enrichedPackForDisplay} onOpenDetail={() => setShowPackModal(true)} />
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
        text: text,
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

  // Fonction pour confirmer génération depuis IntentPanel
  async function handleConfirmGeneration(selectedIds: string[], options?: { useBrandKit?: boolean }) {
    if (!pendingPack || !profile?.active_brand_id || !profile?.id) {
      toast.error("Données manquantes pour lancer la génération");
      return;
    }
    
    const useBrandKit = options?.useBrandKit ?? true;

    const selectedAssets = pendingPack.assets.filter(a => selectedIds.includes(a.id));

    // Plus de validation nécessaire pour video_basic (supprimé)

    setIsGenerating(true);
    try {
      // ✅ ÉTAPE 1 : Générer les textes marketing (comme PackPreparationModal)
      console.log("[ChatWidget] Generating texts for", selectedAssets.length, "assets");
      
      let textsData: any = null;
      let textsError: any = null;
      
      try {
        const response = await supabase.functions.invoke("alfie-generate-texts", {
          body: {
            brandId: profile.active_brand_id,
            brief: pendingPack.summary || pendingPack.title,
            assets: selectedAssets.map((asset) => ({
              id: asset.id,
              kind: asset.kind,
              title: asset.title,
              goal: asset.goal,
              tone: asset.tone,
              platform: asset.platform,
              ratio: asset.ratio,
              count: asset.count,
              durationSeconds: asset.durationSeconds,
              prompt: asset.prompt,
            })),
            useBrandKit: true,
          },
        });
        textsData = response.data;
        textsError = response.error;
      } catch (e) {
        textsError = e;
      }

      // ✅ ÉTAPE 2 : Fallback si génération de textes échoue
      let assetsWithTexts = pendingPack.assets;
      
      if (textsError || !textsData?.texts) {
        console.warn("[ChatWidget] Text generation failed, using fallback:", textsError);
        assetsWithTexts = pendingPack.assets.map((asset) => ({
          ...asset,
          generatedTexts: generateFallbackTexts(asset, pendingPack.title),
        }));
        toast.warning("Textes générés localement");
      } else {
        console.log("[ChatWidget] ✅ Texts generated successfully");
        assetsWithTexts = pendingPack.assets.map((asset) => ({
          ...asset,
          generatedTexts: textsData.texts?.[asset.id] || generateFallbackTexts(asset, pendingPack.title),
        }));
      }

      // ✅ ÉTAPE 3 : Envoyer le pack AVEC les textes générés
      const packWithTexts = { ...pendingPack, assets: assetsWithTexts };
      
      // ✅ Veo 3.1 supporte l'audio généré automatiquement (musique d'ambiance)
      const finalPack = {
        ...packWithTexts,
        assets: packWithTexts.assets.map(a => ({
          ...a,
          withAudio: a.kind === 'video_premium' ? (a.withAudio ?? true) : undefined, // ✅ Audio ON par défaut pour vidéos Veo 3.1
        }))
      };
      
      const result = await sendPackToGenerator({
        brandId: profile.active_brand_id,
        pack: finalPack,
        userId: profile.id,
        selectedAssetIds: selectedIds,
        useBrandKit,
        userPlan: profile.plan || 'starter', // ✅ Plan utilisateur pour sélection du modèle IA
      });
      
      // ✅ Déterminer si c'est une vidéo
      const hasVideo = selectedAssets.some(a => 
        a.kind === 'video_premium' || (a.kind as string) === 'video'
      );
      const assetLabel = hasVideo
        ? (selectedIds.length === 1 ? "vidéo" : "vidéos/visuels")
        : (selectedIds.length === 1 ? "visuel" : "visuels");
      
      // ✅ Message de confirmation dans le chat
      const generationMessage: ChatMessage = {
        role: "assistant",
        text: `Génération lancée (${selectedIds.length} ${assetLabel})`,
        node: assistantCard(
          <div className="space-y-2 text-sm">
            <p>✅ <strong>Génération lancée !</strong></p>
            <p>
              {selectedIds.length} {assetLabel} en cours de création.
              {hasVideo && " Les vidéos peuvent prendre quelques minutes."}
            </p>
            <p className="text-muted-foreground">
              Je te préviendrai ici dès que c'est prêt ! 🔔
            </p>
          </div>,
          false,
        ),
      };
      setMsgs((m) => [...m, generationMessage]);
      
      toast.success(`${selectedIds.length} ${assetLabel} en cours de génération !`);
      
      // ✅ Démarrer le suivi de complétion avec callback
      if (result.orderIds?.length) {
        trackOrders(result.orderIds, {
          isVideo: hasVideo,
          onComplete: (completed, failed) => {
            // ✅ Ajouter un message "Terminé" dans le chat
            const completionMessage: ChatMessage = {
              role: "assistant",
              text: completed > 0 
                ? `Génération terminée ! ${completed} ${assetLabel} prêt(s).`
                : "La génération a échoué.",
              node: assistantCard(
                <div className="space-y-2 text-sm">
                  {completed > 0 ? (
                    <>
                      <p>🎉 <strong>C'est prêt !</strong></p>
                      <p>{completed} {assetLabel} {completed > 1 ? 'ont été créés' : 'a été créé'} avec succès.</p>
                      <button
                        onClick={() => navigate(hasVideo ? '/library?tab=videos' : '/library')}
                        className="inline-block mt-2 px-4 py-2 rounded-md text-sm font-medium text-white"
                        style={{ background: `linear-gradient(135deg, ${BRAND.mint}, ${BRAND.mintDark})` }}
                      >
                        Ouvrir la bibliothèque →
                      </button>
                    </>
                  ) : (
                    <>
                      <p>❌ <strong>Échec de la génération</strong></p>
                      <p>Désolé, la génération n'a pas abouti. Réessaie ou contacte le support.</p>
                    </>
                  )}
                  {failed > 0 && completed > 0 && (
                    <p className="text-muted-foreground text-xs">
                      ⚠️ {failed} asset(s) ont échoué.
                    </p>
                  )}
                </div>,
                false,
              ),
            };
            setMsgs((m) => [...m, completionMessage]);
          },
        });
      }
      setShowIntentPanel(false);
      setPendingPack(null);
    } catch (error) {
      if (error instanceof InsufficientWoofsError) {
        toast.error(error.message);
      } else {
        toast.error("Erreur lors de la génération");
        console.error("Generation error:", error);
      }
    } finally {
      setIsGenerating(false);
    }
  }

  function generateFallbackTexts(asset: any, campaignTitle: string): any {
    if (asset.kind === 'carousel') {
      const topic = asset.prompt || asset.title || campaignTitle;
      const totalSlides = asset.count || 5;
      
      // ✅ Titres DIFFÉRENCIÉS pour chaque slide intermédiaire
      const defaultTitles = ["Le problème", "La solution", "Les avantages", "Comment ça marche", "Ce qui change"];
      const defaultSubtitles = ["Découvrez ce défi courant...", "Voici notre approche...", "Ce que vous obtenez...", "Simple et efficace...", "Faites le premier pas..."];
      
      return {
        slides: Array.from({ length: totalSlides }, (_, i) => {
          if (i === 0) {
            return { title: asset.title || topic, subtitle: campaignTitle };
          } else if (i === totalSlides - 1) {
            return { title: "Passez à l'action", subtitle: "Prêt à commencer ?" };
          } else {
            // ✅ Titres UNIQUES par position
            const titleIndex = Math.min(i - 1, defaultTitles.length - 1);
            return { title: defaultTitles[titleIndex], subtitle: defaultSubtitles[titleIndex] };
          }
        }),
      };
    }
    
    if (asset.kind?.includes('video')) {
      return {
        video: {
          hook: asset.title || "Découvrez",
          script: asset.prompt?.slice(0, 200) || "",
          cta: "En savoir plus",
        },
      };
    }
    
    return {
      text: {
        title: asset.title,
        body: asset.prompt?.slice(0, 120) || "",
        cta: "En savoir plus",
      },
    };
  }

  // Fonction pour réinitialiser la conversation
  function resetConversation() {
    setMsgs([]);
    setPendingPack(null);
    setInput("");
    setShowIntentPanel(false);
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

      {/* AssetEditDialog pour éditer les assets */}
      {editingAsset && (
        <AssetEditDialog
          asset={editingAsset as PackAsset}
          isOpen={true}
          onClose={() => setEditingAsset(null)}
          onSave={(updated) => {
            setPendingPack(prev => prev ? {
              ...prev,
              assets: prev.assets.map(a => a.id === updated.id ? updated : a)
            } : null);
            setEditingAsset(null);
            toast.success("Asset modifié avec succès");
          }}
        />
      )}

      {/* IntentPanel pour mode contrôlé (plusieurs assets) */}
      {showIntentPanel && pendingPack && (
        <IntentPanel
          intents={pendingPack.assets}
          onConfirm={handleConfirmGeneration}
          isLoading={isGenerating}
          onEdit={(intent) => {
            setEditingAsset(intent);
          }}
          onRemove={(id) => {
            setPendingPack(prev => prev ? {
              ...prev,
              assets: prev.assets.filter(a => a.id !== id)
            } : null);
          }}
          onUpdateIntent={(intentId, updates) => {
            setPendingPack(prev => prev ? {
              ...prev,
              assets: prev.assets.map(a => a.id === intentId ? { ...a, ...updates } : a)
            } : null);
          }}
          onClose={() => setShowIntentPanel(false)}
        />
      )}

      {/* Modal de préparation du pack (pour assets uniques) */}
      {showPackModal && pendingPack && profile?.active_brand_id && (
        <PackPreparationModal
          pack={pendingPack}
          brandId={profile.active_brand_id}
          onClose={() => setShowPackModal(false)}
        />
      )}

      {open && (
        <div
          className="fixed bottom-2 right-2 left-2 sm:bottom-6 sm:right-6 sm:left-auto w-auto sm:w-[400px] h-[calc(100vh-env(safe-area-inset-bottom)-120px)] sm:h-[580px] max-h-[90vh] rounded-2xl shadow-2xl border flex flex-col z-[9999] safe-bottom"
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
              Alfie Chat
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

          <div className="flex-1 overflow-auto p-3 space-y-2" style={{ color: BRAND.ink }}>
            {msgs.length === 0 ? (
              <p className="text-sm">
                Salut ! Je suis Alfie, ton assistant. Dis-moi ce que tu veux créer : carrousel, images, vidéos… ou pose-moi une question stratégie, je suis là pour t'aider 🐾
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

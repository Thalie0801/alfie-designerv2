import { detectHost, type HostId, type RequestLike } from "./context";
import type { SessionState } from "./session";
import {
  DesignBriefSchema,
  normalizeSlides,
  type DesignBrief,
  type PartialDesignBrief,
} from "../../src/ai/designBrief.ts";
import {
  renderBriefRecap,
  renderLaunchConfirmation,
  renderQueueStatus,
  renderUnavailableMessage,
} from "../../src/ai/templates.ts";
import { applyTonePack, type TonePack } from "../../src/ai/tone.ts";
import { enqueueJob, searchAssets, type EnqueueJobResult } from "../../src/ai/tools.ts";

const DEFAULT_TONE_PACK: TonePack = "brand_default";

export type DetectedIntent =
  | "create_image"
  | "create_carousel"
  | "create_video"
  | "question"
  | "smalltalk";

type SlotKey = "objective" | "format" | "style" | "prompt" | "slides";

type SessionBriefDraft = PartialDesignBrief & {
  kind?: DesignBrief["kind"];
  brandId?: string;
  tone_pack?: TonePack;
};

type AssistantSessionState = SessionState & {
  flags?: Record<string, boolean>;
  draft?: SessionBriefDraft;
  readyBrief?: DesignBrief;
  intent?: DetectedIntent;
  stage?: "idle" | "collecting" | "confirm";
  questionCount?: number;
  tonePack?: TonePack;
  lastOrderId?: string;
  queueSize?: number | null;
};

type ChatContext = {
  req: RequestLike;
  brandId: string;
  userId?: string;
  session: AssistantSessionState;
  lastDeliverableId?: string;
  reply: (text: string, opts?: { quick?: string[] }) => Promise<void> | void;
};

function ensureFlags(session: AssistantSessionState): Record<string, boolean> {
  if (!session.flags) session.flags = {};
  return session.flags;
}

function ensureSessionFlag(ctx: ChatContext, key: string) {
  const flags = ensureFlags(ctx.session);
  if (!flags[key]) {
    flags[key] = true;
    return false;
  }
  return true;
}

function detectIntent(text: string, fallback?: DetectedIntent): DetectedIntent {
  const normalized = text.toLowerCase();

  if (/carrousel|carousel/.test(normalized)) return "create_carousel";
  if (/vid[ée]o|video|reel|short|tiktok/.test(normalized)) return "create_video";
  if (/image|visuel|bann[iî]re|cover/.test(normalized)) return "create_image";
  if (/[?]|comment|pourquoi|quand|combien/.test(normalized)) return "question";
  return fallback ?? "smalltalk";
}

function mapIntentToKind(intent: DetectedIntent): DesignBrief["kind"] | undefined {
  switch (intent) {
    case "create_carousel":
      return "carousel";
    case "create_video":
      return "video";
    case "create_image":
      return "image";
    default:
      return undefined;
  }
}

function updateDraftFromMessage(
  message: string,
  ctx: ChatContext,
  intent: DetectedIntent,
): SessionBriefDraft {
  const current = ctx.session.draft ?? {};
  const next: SessionBriefDraft = { ...current };

  const kind = mapIntentToKind(intent) ?? current.kind;
  if (kind) next.kind = kind;

  next.brandId = ctx.brandId;
  next.tone_pack = ctx.session.tonePack ?? next.tone_pack ?? DEFAULT_TONE_PACK;

  const normalized = message.trim().toLowerCase();

  if (!next.objective) {
    if (/acqui/.test(normalized)) next.objective = "acquisition";
    else if (/convert|vente|achat/.test(normalized)) next.objective = "conversion";
    else if (/aware|notori|visibilit/.test(normalized)) next.objective = "awareness";
  }

  if (!next.format) {
    const formatMatch = normalized.match(/(1:1|4:5|9:16|16:9)/);
    if (formatMatch) next.format = formatMatch[1] as DesignBrief["format"];
  }

  if (!next.style) {
    if (/minimal|épur|sobre/.test(normalized)) next.style = "minimal";
    else if (/vibrant|color|flashy/.test(normalized)) next.style = "vibrant";
    else if (/pro(fessionnel)?|corporate|b2b/.test(normalized)) next.style = "professional";
    else if (/brand|marque|charte/.test(normalized)) next.style = "brand";
  }

  if (kind === "carousel") {
    const slideMatch = normalized.match(/(\d{1,2})\s*(?:slides?|écrans?)/);
    if (slideMatch) {
      next.slides = normalizeSlides("carousel", Number.parseInt(slideMatch[1], 10));
    }
  }

  if (!next.templateId) {
    const templateMatch = normalized.match(/template\s*([a-z0-9-_]+)/);
    if (templateMatch) {
      next.templateId = templateMatch[1];
    }
  }

  const isShortChoice = [
    "acquisition",
    "conversion",
    "awareness",
    "minimal",
    "vibrant",
    "style marque",
    "professionnel",
    "3",
    "5",
    "suggérer un prompt",
    "je donne mon prompt",
  ].includes(normalized);

  if (!isShortChoice) {
    const cleaned = message.trim();
    if (cleaned.length > 20) {
      next.prompt = cleaned;
    }
  }

  return next;
}

function collectMissingSlots(draft: SessionBriefDraft): SlotKey[] {
  const missing: SlotKey[] = [];
  if (!draft.objective) missing.push("objective");
  if (!draft.format) missing.push("format");
  if (!draft.style) missing.push("style");
  if (!draft.prompt) missing.push("prompt");
  if (draft.kind === "carousel" && !draft.slides) missing.push("slides");
  return missing;
}

function buildQuestion(
  slot: SlotKey,
  draft: SessionBriefDraft,
  tone: TonePack,
): { message: string; quick: [string, string] } {
  switch (slot) {
    case "objective": {
      const message = applyTonePack(
        "Quel est l’objectif principal ? Acquisition ou conversion ? (Réponds “awareness” si tu vises la notoriété.)",
        tone,
      );
      return { message, quick: ["Acquisition", "Conversion"] };
    }
    case "format": {
      const kind = draft.kind ?? "image";
      const options = kind === "video" ? ["9:16", "16:9"] : kind === "carousel" ? ["9:16", "1:1"] : ["1:1", "4:5"];
      const message = applyTonePack("Quel format t’arrange le plus ?", tone);
      return { message, quick: options as [string, string] };
    }
    case "style": {
      const message = applyTonePack(
        "Tu préfères un rendu minimal ou plutôt vibrant ? (Dis “style marque” si tu veux rester sur la charte.)",
        tone,
      );
      return { message, quick: ["Minimal", "Vibrant"] };
    }
    case "prompt": {
      const message = applyTonePack(
        "Tu veux que je suggère un prompt, ou tu me donnes ton texte ?",
        tone,
      );
      return { message, quick: ["Suggérer un prompt", "Je donne mon prompt"] };
    }
    case "slides": {
      const message = applyTonePack("Combien de slides pour ce carrousel ?", tone);
      return { message, quick: ["3", "5"] };
    }
    default: {
      return { message: applyTonePack("Dis-m’en un peu plus.", tone), quick: ["OK", "Modifier"] };
    }
  }
}

function buildPromptSuggestion(draft: SessionBriefDraft): string {
  const kind = draft.kind ?? "image";
  if (kind === "carousel") {
    return "Série de 5 slides: hook, trois bénéfices, CTA final. Style fidèle à la marque.";
  }
  if (draft.objective === "conversion" && draft.format === "4:5") {
    return "Packshot produit + label promo 30%, fond uni couleur de la marque, CTA discret.";
  }
  if (draft.objective === "awareness" && draft.format === "1:1") {
    return "Un visuel épuré avec la couleur phare de la marque et un titre court sur le bénéfice clé.";
  }
  return "Un visuel impactant qui met en avant le bénéfice principal de l’offre.";
}

function finalizeBrief(draft: SessionBriefDraft): DesignBrief | null {
  if (!draft.brandId || !draft.kind || !draft.objective || !draft.format || !draft.style || !draft.prompt || !draft.tone_pack) {
    return null;
  }

  const candidate: DesignBrief = {
    brandId: draft.brandId,
    kind: draft.kind,
    objective: draft.objective,
    format: draft.format,
    style: draft.style,
    prompt: draft.prompt,
    slides: normalizeSlides(draft.kind, draft.slides ?? null),
    templateId: draft.templateId ?? null,
    tone_pack: draft.tone_pack,
  };

  const parsed = DesignBriefSchema.safeParse(candidate);
  return parsed.success ? parsed.data : null;
}

function isAffirmative(text: string): boolean {
  return /^(oui|ok|let’s go|c’est parti|go)$/i.test(text.trim());
}

function isModifier(text: string): boolean {
  return /modifier|change|ajuste|reprenons/i.test(text);
}

function isStatusQuery(text: string): boolean {
  return /(statut|status|où en|avancement|progress)/i.test(text);
}

function shouldSuggestPrompt(choice: string): boolean {
  return /sugg[eé]rer un prompt/i.test(choice);
}

function shouldCapturePrompt(choice: string): boolean {
  return /je donne mon prompt/i.test(choice);
}

function parseNumericChoice(value: string): number | null {
  const match = value.trim().match(/^(\d{1,2})$/);
  if (!match) return null;
  return Number.parseInt(match[1], 10);
}

function isActionAvailable(intent: DetectedIntent, ctx: ChatContext): boolean {
  const env = (ctx.req?.env ?? {}) as Record<string, unknown>;
  const map: Partial<Record<DetectedIntent, string>> = {
    create_image: "FLAG_IMAGE",
    create_carousel: "FLAG_CAROUSEL",
    create_video: "FLAG_VIDEO",
  };
  const flagKey = map[intent];
  if (!flagKey) return true;
  const raw = env[flagKey];
  if (typeof raw === "string") {
    const normalized = raw.toLowerCase();
    if (normalized === "0" || normalized === "false" || normalized === "off") return false;
  }
  if (typeof raw === "number") {
    return raw !== 0;
  }
  if (typeof raw === "boolean") return raw;
  return true;
}

async function handleStatusRequest(text: string, ctx: ChatContext, tone: TonePack) {
  if (!ctx.session.lastOrderId) {
    await ctx.reply(applyTonePack("Je n’ai pas de commande en cours à suivre.", tone));
    return;
  }

  try {
    const { assets } = await searchAssets({ brandId: ctx.brandId, orderId: ctx.session.lastOrderId }, ctx.req.env);
    const asset = assets.find((item) => item.preview_url || item.cloudinary_url);
    if (!asset) {
      const message = renderQueueStatus({ kind: "queued", studioUrl: `/studio?order=${ctx.session.lastOrderId}` , tone });
      await ctx.reply(message);
      return;
    }

    const preview = asset.preview_url ?? asset.cloudinary_url ?? "";
    const download = asset.download_url ?? undefined;
    const message = renderQueueStatus({ kind: "done", previewUrl: preview, downloadUrl: download, tone });
    await ctx.reply(message);
  } catch (error) {
    const message = renderQueueStatus({
      kind: "error",
      shortError: error instanceof Error ? error.message : "statut indisponible",
      tone,
    });
    await ctx.reply(message);
  }
}

function resetDraft(session: AssistantSessionState) {
  session.draft = undefined;
  session.readyBrief = undefined;
  session.questionCount = 0;
  session.stage = "idle";
}

async function processDesignerMessage(text: string, ctx: ChatContext) {
  ctx.session.tonePack = ctx.session.tonePack ?? DEFAULT_TONE_PACK;
  const tone = ctx.session.tonePack;
  const trimmed = text.trim();

  if (!trimmed) {
    await ctx.reply(applyTonePack("Dis-m’en un peu plus sur ce que tu veux créer.", tone));
    return;
  }

  if (isStatusQuery(trimmed)) {
    await handleStatusRequest(trimmed, ctx, tone);
    return;
  }

  if (ctx.session.stage === "confirm") {
    if (isAffirmative(trimmed) && ctx.session.readyBrief) {
      await launchGeneration(ctx, ctx.session.readyBrief);
      return;
    }
    if (isModifier(trimmed)) {
      ctx.session.stage = "collecting";
      await ctx.reply(applyTonePack("Très bien, qu’est-ce qu’on ajuste ?", tone));
      return;
    }
  }

  const intent = detectIntent(trimmed, ctx.session.intent);
  ctx.session.intent = intent;

  if (intent === "question" || intent === "smalltalk") {
    await ctx.reply(
      applyTonePack(
        "Je peux te préparer une image, une vidéo courte ou un carrousel complet. Dis-moi le format et l’objectif, je m’occupe du brief.",
        tone,
      ),
    );
    return;
  }

  if (!isActionAvailable(intent, ctx)) {
    await ctx.reply(renderUnavailableMessage(tone));
    return;
  }

  const draft = updateDraftFromMessage(trimmed, ctx, intent);
  ctx.session.draft = draft;

  if (shouldSuggestPrompt(trimmed)) {
    draft.prompt = buildPromptSuggestion(draft);
  } else if (shouldCapturePrompt(trimmed) && !draft.prompt) {
    await ctx.reply(applyTonePack("Top, envoie ton prompt en une phrase claire.", tone));
    ctx.session.stage = "collecting";
    return;
  }

  if (draft.kind === "carousel" && !draft.slides) {
    const numeric = parseNumericChoice(trimmed);
    if (numeric) {
      draft.slides = normalizeSlides("carousel", numeric);
    }
  }

  const missing = collectMissingSlots(draft);
  const maxQuestions = 5;
  if (missing.length > 0 && (ctx.session.questionCount ?? 0) < maxQuestions) {
    const question = buildQuestion(missing[0], draft, tone);
    ctx.session.questionCount = (ctx.session.questionCount ?? 0) + 1;
    ctx.session.stage = "collecting";
    await ctx.reply(question.message, { quick: question.quick });
    return;
  }

  const ready = finalizeBrief(draft);
  if (!ready) {
    await ctx.reply(applyTonePack("Il me manque encore quelques détails pour sécuriser le brief.", tone));
    ctx.session.stage = "collecting";
    return;
  }

  ctx.session.readyBrief = ready;
  ctx.session.stage = "confirm";
  ctx.session.questionCount = 0;

  const summary = renderBriefRecap(ready, tone);
  await ctx.reply(summary, { quick: ["Oui, lancer", "Modifier"] });
}

async function launchGeneration(ctx: ChatContext, brief: DesignBrief) {
  const tone = brief.tone_pack;
  try {
    const result: EnqueueJobResult = await enqueueJob({ brief }, ctx.req.env);
    ctx.session.lastOrderId = result.orderId;
    ctx.session.queueSize = result.queueSize ?? null;
    const confirmation = renderLaunchConfirmation(result.orderId, {
      tone,
    });
    const queueMessage =
      typeof result.queueSize === "number" && result.queueSize > 0
        ? applyTonePack(
            `Il y a ${result.queueSize} création(s) dans la file, compte quelques minutes.`,
            tone,
          )
        : null;
    if (queueMessage) {
      await ctx.reply(`${confirmation}\n\n${queueMessage}`);
    } else {
      await ctx.reply(confirmation);
    }
    resetDraft(ctx.session);
  } catch (error) {
    const message = renderQueueStatus({
      kind: "error",
      shortError: error instanceof Error ? error.message : "imprévu",
      tone,
    });
    await ctx.reply(message);
    ctx.session.stage = "collecting";
  }
}

function buildEditorialReply(text: string, ctx: ChatContext) {
  const normalized = text.toLowerCase();
  const quick: string[] = [];

  if (!ensureSessionFlag(ctx, "editorial_intro")) {
    return {
      message: "Bonjour ! Je suis Alfie Editorial. Pose-moi tes questions KPI, SEO ou copy et je te donne une analyse précise pour ta marque.",
      quick,
    };
  }

  if (normalized.includes("seo")) {
    return {
      message: "Voici une checklist SEO rapide : structure H1/H2 claire, balises title optimisées et maillage interne vers tes pages prioritaires.",
      quick: ["Analyse KPI", "Plan éditorial"],
    };
  }

  if (normalized.includes("kpi") || normalized.includes("performance")) {
    return {
      message: "Sur tes KPI, suis le taux de conversion post-publication et le temps de lecture moyen. Besoin d’un plan d’action ?",
      quick,
    };
  }

  if (normalized.includes("plan") || normalized.includes("calendar") || normalized.includes("calendrier")) {
    return {
      message: "Je te propose un plan éditorial sur 4 semaines : insight, preuve sociale, tutoriel, puis CTA fort. Tu veux que je détaille les contenus ?",
      quick,
    };
  }

  if (!ensureSessionFlag(ctx, "editorial_designer_nudge")) {
    return {
      message: "D’ailleurs, si tu veux transformer ces idées en visuels, je peux te connecter à Alfie Designer pour la production.",
      quick: ["Ouvrir Designer"],
    };
  }

  return {
    message: "Dis-moi si tu as besoin d’une analyse KPI, d’un plan éditorial ou de copy optimisée, je suis là pour ça !",
    quick,
  };
}

export async function handleUserText(text: string, ctx: ChatContext) {
  const host: HostId = detectHost(ctx.req);
  if (host === "designer") {
    await processDesignerMessage(text, ctx);
    return;
  }

  const result = buildEditorialReply(text, ctx);
  await ctx.reply(result.message, { quick: result.quick.length ? result.quick : undefined });
}

export type { ChatContext };

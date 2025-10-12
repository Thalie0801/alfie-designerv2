import { detectHost, type HostId } from "./context";

type ChatContext = {
  req: any;
  brandId: string;
  userId?: string;
  session: Record<string, boolean>;
  lastDeliverableId?: string;
  reply: (text: string, opts?: { quick?: string[] }) => Promise<void> | void;
};

function ensureSessionFlag(ctx: ChatContext, key: string) {
  if (!ctx.session[key]) {
    ctx.session[key] = true;
    return false;
  }
  return true;
}

function buildDesignerReply(text: string, ctx: ChatContext) {
  const normalized = text.toLowerCase();
  const quick: string[] = [];

  if (!ensureSessionFlag(ctx, "designer_intro")) {
    quick.push("Proposer un carrousel", "Créer une image de couverture");
    return {
      message:
        "Salut ! Je suis Alfie Designer. Dis-moi quel visuel ou carrousel tu veux que je conçoive et je te prépare ça (export Canva + ZIP).",
      quick,
    };
  }

  if (normalized.includes("carrousel")) {
    const deliverableId = `carousel-${Date.now()}`;
    ctx.lastDeliverableId = deliverableId;
    return {
      message:
        "Parfait, je vais concevoir un carrousel multi-slides pour toi. Je t'enverrai un lien Canva et un ZIP dès que c'est prêt !",
      quick,
    };
  }

  if (normalized.includes("quota")) {
    return {
      message:
        "Tu as encore largement de la marge sur tes quotas ce mois-ci. Tu veux que je lance une nouvelle création ?",
      quick: ["Créer une image", "Préparer un carrousel"],
    };
  }

  if (normalized.includes("image") || normalized.includes("visuel") || normalized.includes("design")) {
    const deliverableId = `visual-${Date.now()}`;
    ctx.lastDeliverableId = deliverableId;
    return {
      message:
        "Super idée ! Je me mets sur la création tout de suite et je te partage le pack (Canva + ZIP) dans ce chat dès que possible.",
      quick,
    };
  }

  return {
    message:
      "Dis-moi ce que tu veux que je crée : image, carrousel, vidéo courte… Je m'occupe de la production et de la livraison.",
    quick: ["Créer un carrousel", "Créer une image"],
  };
}

function buildEditorialReply(text: string, ctx: ChatContext) {
  const normalized = text.toLowerCase();
  const quick: string[] = [];

  if (!ensureSessionFlag(ctx, "editorial_intro")) {
    return {
      message:
        "Bonjour ! Je suis Alfie Editorial. Pose-moi tes questions KPI, SEO ou copy et je te donne une analyse précise pour ta marque.",
      quick,
    };
  }

  if (normalized.includes("seo")) {
    return {
      message:
        "Voici une checklist SEO rapide : structure H1/H2 claire, balises title optimisées et maillage interne vers tes pages prioritaires.",
      quick: ["Analyse KPI", "Plan éditorial"],
    };
  }

  if (normalized.includes("kpi") || normalized.includes("performance")) {
    return {
      message:
        "Sur tes KPI, je recommande de suivre le taux de conversion post-publication et le temps de lecture moyen. Besoin d'un plan d'action ?",
      quick,
    };
  }

  if (normalized.includes("plan") || normalized.includes("calendar") || normalized.includes("calendrier")) {
    return {
      message:
        "Je te propose un plan éditorial sur 4 semaines : insights, preuve sociale, tutoriel, puis CTA fort. Tu veux que je détaille les contenus ?",
      quick,
    };
  }

  if (!ensureSessionFlag(ctx, "editorial_designer_nudge")) {
    return {
      message:
        "D'ailleurs, si tu veux transformer ces idées en visuels, je peux te connecter à Alfie Designer pour la production.",
      quick: ["Ouvrir Designer"],
    };
  }

  return {
    message:
      "Dis-moi si tu as besoin d'une analyse KPI, d'un plan éditorial ou de copy optimisée, je suis là pour ça !",
    quick,
  };
}

export async function handleUserText(text: string, ctx: ChatContext) {
  const host: HostId = detectHost(ctx.req);
  const result = host === "designer" ? buildDesignerReply(text, ctx) : buildEditorialReply(text, ctx);
  await ctx.reply(result.message, { quick: result.quick.length ? result.quick : undefined });
}

export type { ChatContext };

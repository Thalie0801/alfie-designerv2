type Ratio = "1:1" | "9:16" | "16:9" | "3:4" | "4:5" | "2:3";
type Platform = "instagram" | "tiktok" | "pinterest" | "linkedin" | "youtube";
type Mode = "carousel" | "video" | "image";
type Niche = "ecommerce" | "infopreneur" | "services" | "mlm" | "creator";

export function detectContentIntent(raw: string) {
  const q = raw.toLowerCase().trim();

  const isCarousel = /(carrousel|carousel|slides?)/.test(q);
  const isVideo = /(vidéo|video|shorts?|reels?)/.test(q);
  const isImage = /(image|visuel|post|miniature|vignette)/.test(q);
  const explicitMode = isCarousel || isVideo || isImage;
  const mode: Mode = isCarousel ? "carousel" : isVideo ? "video" : "image";

  const platform: Platform | null =
    (/(instagram|insta)/.test(q) && "instagram") ||
    (/tiktok/.test(q) && "tiktok") ||
    (/pinterest/.test(q) && "pinterest") ||
    (/linkedin/.test(q) && "linkedin") ||
    (/youtube|shorts?/.test(q) && "youtube") ||
    null;

  const m = q.match(/\b(1:1|9:16|16:9|3:4|4:5|2:3)\b/);
  const ratioFromText: Ratio | undefined = m ? (m[1] as Ratio) : undefined;

  const defaultRatioByPlatform: Record<string, Ratio> = {
    instagram: isCarousel ? "4:5" : "1:1",
    tiktok: "9:16",
    pinterest: "2:3",
    linkedin: "1:1",
    youtube: "16:9",
  };

  const fallback: Ratio = isVideo ? "9:16" : isCarousel ? "4:5" : "1:1";
  const ratio: Ratio = ratioFromText ?? (platform ? defaultRatioByPlatform[platform] ?? fallback : fallback);

  const tone =
    (/(apple|minimal|sobre|premium)/.test(q) && "premium") ||
    (/(fun|joueuse|pop|emoji|émoji)/.test(q) && "fun") ||
    (/(b2b|pro|corporate)/.test(q) && "b2b") ||
    null;

  const slides = (() => {
    const sm = q.match(/(\d+)\s*(slides?|pages?)/);
    if (sm) return Math.min(10, Math.max(3, parseInt(sm[1], 10)));
    if (mode === "carousel") return 5;
    return undefined;
  })();

  const mCTA = q.match(/\b(cta|appel\s*à\s*l['']?action)\s*:?["""']?([^"""']+)["""']?/);
  const cta = mCTA?.[2]?.trim() || null;

  const topicRaw = q
    .replace(/(donne|donnez|propose|proposez|idées?|fais|fais-moi|fais moi|crée?|génère?|aide( moi)?|un sujet|sujet)/g, "")
    .replace(/(de|des|du|un|une|le|la|les|sur|pour|en|d'|l')/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const topicWords = topicRaw.split(" ").filter(Boolean);
  const needTopic = topicWords.length < 2;

  const niche: Niche | undefined = (() => {
    if (/(e-?commerce|boutique|eshop|boutique en ligne|produits|stock|commande|panier)/.test(q)) return "ecommerce";
    if (/(infopreneur|formation|programme|cours en ligne|webinar|masterclass|coaching en ligne)/.test(q)) return "infopreneur";
    if (/(coach|consultant|consultante|accompagnement|prestataire|freelance service|audit)/.test(q)) return "services";
    if (/(vdi|mlm|vente directe|vente a domicile|kit de démarrage|duplicable|mon équipe)/.test(q)) return "mlm";
    if (/(créateur de contenu|influenceur|bons? plans?|communauté|storytime|sélection produit)/.test(q)) return "creator";
    return undefined;
  })();

  return { mode, explicitMode, platform, ratio, tone, slides, cta, topic: needTopic ? null : topicRaw, needTopic, niche };
}

export function detectPlatformHelp(raw: string) {
  const q = raw.toLowerCase();

  const intents = [
    { test: /(studio|génération|créer|lancer)/, to: "/studio", label: "Ouvrir Studio" },
    { test: /(template|catalogue|modèles?)/, to: "/templates", label: "Catalogue" },
    { test: /(bibliothèque|assets?|médias?)/, to: "/library", label: "Bibliothèque" },
    { test: /(brand[\s-]?kit|marque|couleurs|typo)/, to: "/brand-kit-questionnaire", label: "Brand Kit" },
    { test: /(factur|abonnement|paiement|pricing|prix|crédit|woofs)/, to: "/billing", label: "Facturation" },
    { test: /(profil|compte|email|mot de passe)/, to: "/profile", label: "Profil" },
    { test: /(dashboard|stat|performances?)/, to: "/dashboard", label: "Dashboard" },
    { test: /(affiliation|parrain|ambassadeur)/, to: "/affiliate", label: "Affiliation" },
    { test: /(contact|support|aide|bug|problème)/, to: "/contact", label: "Contact" },
    { test: /(admin|job queue|monitor|bloqués?)/, to: "/admin", label: "Admin" },
  ];

  const matches = intents.filter((i) => i.test.test(q));

  const isWhatCanDo =
    /(que|quoi).*(peut|peux).*(faire|proposer)|capacités?|features?|fonctionnalités?|comment (ça|ca) marche|mode d'emploi|help/i.test(q);

  return { matches, isWhatCanDo };
}

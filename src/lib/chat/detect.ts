export function detectContentIntent(raw: string) {
  const q = raw.toLowerCase().trim();

  const isCarousel = /(carou?sel|slides?)/.test(q);
  const isVideo = /(vid[eé]o|shorts?|reels?)/.test(q);
  const mode: "carousel" | "video" | "image" = isCarousel ? "carousel" : isVideo ? "video" : "image";

  const platform =
    (/(instagram|insta)/.test(q) && "instagram") ||
    (/tiktok/.test(q) && "tiktok") ||
    (/pinterest/.test(q) && "pinterest") ||
    (/linkedin/.test(q) && "linkedin") ||
    (/youtube|shorts?/.test(q) && "youtube") ||
    null;

  const ratioFromText = q.match(/\b(1:1|9:16|16:9|3:4|4:5|2:3)\b/)?[1] as
    | "1:1"
    | "9:16"
    | "16:9"
    | "3:4"
    | "4:5"
    | "2:3"
    | undefined;

  const defaultRatioByPlatform: Record<string, any> = {
    instagram: isCarousel ? "4:5" : "1:1",
    tiktok: "9:16",
    pinterest: "2:3",
    linkedin: "1:1",
    youtube: "16:9",
  };
  const ratio = ratioFromText || (platform ? defaultRatioByPlatform[platform] || "1:1" : isVideo ? "9:16" : isCarousel ? "4:5" : "1:1");

  const tone =
    (/(apple|minimal|sobre|premium)/.test(q) && "premium") ||
    (/(fun|joueuse|pop|emoji|émoji)/.test(q) && "fun") ||
    (/(b2b|pro|corporate)/.test(q) && "b2b") ||
    null;

  const slides = (() => {
    const m = q.match(/(\d+)\s*(slides?|pages?)/);
    if (m) return Math.min(10, Math.max(3, parseInt(m[1], 10)));
    if (mode === "carousel") return 5;
    return undefined;
  })();

  const mCTA = q.match(/\b(cta|appel\s*à\s*l[’']?action)\s*:?["“”']?([^"“”']+)["“”']?/);
  const cta = mCTA?.[2]?.trim() || null;

  // topic
  const topicRaw = q
    .replace(/(donne|donnez|propose|proposez|id[ée]es?|fais|fais-moi|fais moi|cr[ée]e?|g[ée]n[èe]re?|aide( moi)?|un sujet \??|sujet \??)/g, "")
    .replace(/(de|des|du|un|une|le|la|les|sur|pour|en|d’|l’)/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const topicWords = topicRaw.split(" ").filter(Boolean);
  const needTopic = topicWords.length < 2;

  return { mode, platform, ratio, tone, slides, cta, topic: needTopic ? null : topicRaw, needTopic };
}

export function detectPlatformHelp(raw: string) {
  const q = raw.toLowerCase();

  const intents = [
    { test: /(studio|g[ée]n[ée]ration|cr[ée]er|lancer)/, to: "/studio", label: "Ouvrir Studio" },
    { test: /(template|catalogue|mod[èe]les?)/, to: "/templates", label: "Catalogue" },
    { test: /(bibli[oô]th[eè]que|assets?|m[ée]dias?)/, to: "/library", label: "Bibliothèque" },
    { test: /(brand[\s-]?kit|marque|couleurs|typo)/, to: "/brand-kit-questionnaire", label: "Brand Kit" },
    { test: /(factur|abonnement|paiement|pricing|prix|cr[ée]dit|woofs)/, to: "/billing", label: "Facturation" },
    { test: /(profil|compte|email|mot de passe)/, to: "/profile", label: "Profil" },
    { test: /(dashboard|stat|performances?)/, to: "/dashboard", label: "Dashboard" },
    { test: /(affiliation|parrain|ambassadeur)/, to: "/affiliate", label: "Affiliation" },
    { test: /(contact|support|aide|bug|probl[èe]me)/, to: "/contact", label: "Contact" },
    { test: /(admin|job queue|monitor|bloqu[ée]s?)/, to: "/admin", label: "Admin" },
  ];

  const matches = intents.filter((i) => i.test.test(q));

  const isWhatCanDo =
    /(que|quoi).*(peut|peux).*(faire|proposer)|capacit[ée]s?|features?|fonctionnalit[ée]s?|comment (ça|ca) marche|mode d'emploi|help/i.test(
      q
    );

  return { matches, isWhatCanDo };
}

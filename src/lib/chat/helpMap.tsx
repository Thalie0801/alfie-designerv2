export const HELP = [
  // Studio Solo (par défaut)
  { match: /ouvr(e|ir)\s+(le\s+)?studio|lance\s+(le\s+)?studio|accéder\s+(au\s+)?studio|studio\s*solo/i, to: "/studio", label: "Studio Solo", why: "Créer 1 image, carrousel ou vidéo" },
  // Studio Multi (packs/campagnes)
  { match: /studio\s*multi|pack|campagne|mini.?film|plusieurs?\s+visuels?/i, to: "/studio/multi", label: "Studio Multi", why: "Créer des packs et campagnes" },
  // Optimiseur de prompts
  { match: /optimi(s|z)e(r)?.*prompt|prompt.*optimi(s|z)|améliorer.*prompt|prompt.*pro/i, to: "/prompt-optimizer", label: "Optimiseur de Prompts", why: "Transformer tes idées en prompts pro" },
  // Autres routes
  { match: /template|catalogue|modèles?/i, to: "/templates", label: "Catalogue", why: "Parcourir les modèles" },
  { match: /bibli|assets?|médias?/i, to: "/library", label: "Bibliothèque", why: "Retrouver vos visuels" },
  { match: /brand.?kit|couleurs|typo/i, to: "/brand-kit", label: "Brand Kit", why: "Couleurs, typographies, ton" },
  { match: /factur|abonn|paiement|pricing|prix|crédit|woofs/i, to: "/billing", label: "Facturation", why: "Plan et crédits" },
  { match: /profil|compte|email|mot de passe/i, to: "/profile", label: "Profil", why: "Infos du compte" },
  { match: /dashboard|stat|performances?/i, to: "/dashboard", label: "Dashboard", why: "Vue d'ensemble" },
  { match: /affiliation|parrain|ambassadeur/i, to: "/affiliate", label: "Affiliation", why: "Parrainez & gagnez" },
  { match: /contact|support|aide|bug|problème/i, to: "/contact", label: "Contact", why: "Besoin d'aide ?" },
];

export function whatCanDoBlocks() {
  return (
    <div className="space-y-2">
      <p className="text-sm">
        Voici ce que <strong>Alfie Designer</strong> sait faire aujourd'hui :
      </p>
      <ul className="list-disc ml-5 text-sm">
        <li><strong>Studio Solo</strong> : créer <em>1 image, 1 carrousel ou 1 vidéo</em> à la fois.</li>
        <li><strong>Studio Multi</strong> : créer des <em>packs campagne</em> ou des <em>mini-films multi-clips</em>.</li>
        <li><strong>Optimiseur</strong> : transformer tes idées en <em>prompts professionnels</em> optimisés.</li>
        <li><strong>Appliquer</strong> automatiquement ton <em>Brand Kit</em> (couleurs, typo, ton).</li>
        <li><strong>Gérer</strong> un catalogue de <em>Templates</em> et ta <em>Bibliothèque</em> d'assets.</li>
        <li><strong>Suivre</strong> tes crédits/abonnement, et consulter ton <em>Dashboard</em>.</li>
      </ul>
      <div className="pt-1 flex flex-wrap gap-2">
        {HELP.slice(0, 7).map((h) => (
          <a
            key={h.to}
            href={h.to}
            className="inline-block mr-2 mb-2 px-3 py-2 rounded-md text-sm font-medium border border-gray-200 hover:bg-gray-50"
          >
            {h.label}
          </a>
        ))}
      </div>
    </div>
  );
}

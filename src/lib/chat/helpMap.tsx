export const HELP = [
  { match: /studio|génération|créer|lancer/i, to: "/studio", label: "Ouvrir Studio", why: "Lancer une génération guidée" },
  { match: /template|catalogue|modèles?/i, to: "/templates", label: "Catalogue", why: "Parcourir les modèles" },
  { match: /bibli|assets?|médias?/i, to: "/library", label: "Bibliothèque", why: "Retrouver vos visuels" },
  { match: /brand.?kit|couleurs|typo/i, to: "/brand-kit-questionnaire", label: "Brand Kit", why: "Couleurs, typographies, ton" },
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
        <li><strong>Générer</strong> des visuels, carrousels et vidéos à partir d'un brief (via <em>Studio</em>).</li>
        <li><strong>Appliquer</strong> automatiquement ton <em>Brand Kit</em> (couleurs, typo, ton).</li>
        <li><strong>Gérer</strong> un catalogue de <em>Templates</em> et ta <em>Bibliothèque</em> d'assets.</li>
        <li><strong>Suivre</strong> tes crédits/abonnement, et consulter ton <em>Dashboard</em>.</li>
      </ul>
      <div className="pt-1 flex flex-wrap gap-2">
        {HELP.slice(0, 6).map((h) => (
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

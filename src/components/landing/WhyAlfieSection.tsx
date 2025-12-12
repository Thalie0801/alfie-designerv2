import { Clock, Target, Palette, TrendingUp, Shield, Heart } from "lucide-react";

const reasons = [
  {
    icon: Clock,
    title: "Gain de temps massif",
    description: "Ce qui prenait des heures se fait maintenant en quelques minutes.",
  },
  {
    icon: Target,
    title: "Contenu optimisé",
    description: "Chaque visuel est pensé pour maximiser l'engagement.",
  },
  {
    icon: Palette,
    title: "100% brandé",
    description: "Ton identité visuelle respectée sur chaque création.",
  },
  {
    icon: TrendingUp,
    title: "Résultats prouvés",
    description: "+300% d'engagement moyen constaté par nos utilisateurs.",
  },
  {
    icon: Shield,
    title: "Sans abonnement piège",
    description: "Prix transparents, annulation en 1 clic, sans engagement.",
  },
  {
    icon: Heart,
    title: "Support français",
    description: "Une équipe réactive basée en France, à ton écoute.",
  },
];

export function WhyAlfieSection() {
  return (
    <section className="px-4 py-16 sm:py-24 sm:px-6 lg:px-8 bg-white">
      <div className="mx-auto max-w-6xl">
        <div className="text-center mb-12">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-slate-900 mb-4">
            Pourquoi choisir{" "}
            <span className="bg-gradient-to-r from-alfie-mint to-alfie-lilac bg-clip-text text-transparent">
              Alfie Designer
            </span>{" "}
            ?
          </h2>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto">
            Plus qu'un outil, un vrai partenaire pour ta création de contenu.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {reasons.map((reason, idx) => (
            <div
              key={idx}
              className="group p-6 rounded-2xl bg-slate-50 border border-slate-200 hover:bg-slate-100 hover:border-alfie-mint/50 transition-all"
            >
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-alfie-mint/30 to-alfie-lilac/30 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <reason.icon className="h-6 w-6 text-alfie-mint" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900 mb-2">{reason.title}</h3>
              <p className="text-slate-600 text-sm leading-relaxed">
                {reason.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

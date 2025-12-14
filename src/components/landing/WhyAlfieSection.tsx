import { motion } from "framer-motion";
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
    <motion.section 
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true, margin: "-100px" }}
      transition={{ duration: 0.6 }}
      className="px-4 py-16 sm:py-24 sm:px-6 lg:px-8 bg-white"
    >
      <div className="mx-auto max-w-6xl">
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
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
        </motion.div>

        <div className="grid grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-6">
          {reasons.map((reason, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 30, scale: 0.95 }}
              whileInView={{ opacity: 1, y: 0, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: idx * 0.1 }}
              className="group p-3 sm:p-6 rounded-xl sm:rounded-2xl bg-slate-50 border border-slate-200 hover:bg-slate-100 hover:border-alfie-mint/50 transition-all"
            >
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl bg-gradient-to-br from-alfie-mint/30 to-alfie-lilac/30 flex items-center justify-center mb-2 sm:mb-4 group-hover:scale-110 transition-transform">
                <reason.icon className="h-5 w-5 sm:h-6 sm:w-6 text-alfie-mint" />
              </div>
              <h3 className="text-sm sm:text-lg font-semibold text-slate-900 mb-1 sm:mb-2">{reason.title}</h3>
              <p className="text-slate-600 text-xs sm:text-sm leading-relaxed line-clamp-3 sm:line-clamp-none">
                {reason.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </motion.section>
  );
}

import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ArrowRight, Wand2, Images, Film, Palette, Grid3X3 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { trackEvent } from "@/utils/trackEvent";

const features = [
  {
    icon: Wand2,
    title: "Optimiseur de Prompts",
    description: "Transforme une idée brute en prompt professionnel. L'IA affine tout automatiquement.",
    gradient: "from-amber-500/20 to-orange-500/10",
    iconBg: "bg-amber-500/20 text-amber-600",
  },
  {
    icon: Images,
    title: "Images de Référence",
    description: "Uploade 1 à 3 images pour guider le style. Cohérence visuelle garantie.",
    gradient: "from-alfie-mint/30 to-teal-500/10",
    iconBg: "bg-alfie-mint/20 text-teal-600",
  },
  {
    icon: Film,
    title: "Mini-Films Multi-Scènes",
    description: "Crée des vidéos à plusieurs clips avec continuité narrative et lip-sync.",
    gradient: "from-alfie-lilac/30 to-purple-500/10",
    iconBg: "bg-alfie-lilac/20 text-purple-600",
  },
  {
    icon: Palette,
    title: "6 Styles Visuels",
    description: "Photoréaliste, 3D Pixar, Cinématique, Illustration, Minimaliste, Artistique.",
    gradient: "from-alfie-pink/30 to-rose-500/10",
    iconBg: "bg-alfie-pink/20 text-rose-600",
  },
  {
    icon: Grid3X3,
    title: "5 Plateformes, 6 Ratios",
    description: "Instagram, TikTok, LinkedIn, Pinterest, YouTube. Formats 1:1, 4:5, 9:16, 16:9...",
    gradient: "from-blue-500/20 to-indigo-500/10",
    iconBg: "bg-blue-500/20 text-blue-600",
  },
];

export function FeatureCardsSection() {
  const navigate = useNavigate();

  const handleTry = (feature: string) => {
    trackEvent("feature_card_try_click", { feature });
    navigate("/start");
  };

  return (
    <motion.section 
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true, margin: "-100px" }}
      transition={{ duration: 0.6 }}
      className="px-4 py-16 sm:py-24 sm:px-6 lg:px-8 bg-gradient-to-b from-white to-slate-50"
    >
      <div className="mx-auto max-w-5xl">
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-slate-900 mb-4">
            Des outils puissants
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Tout ce qu'il te faut pour créer du contenu qui convertit.
          </p>
        </motion.div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {features.map((feature, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: idx * 0.08 }}
              onClick={() => handleTry(feature.title)}
              className={`group p-5 sm:p-6 rounded-2xl bg-gradient-to-br ${feature.gradient} border border-slate-200/50 hover:shadow-xl transition-all cursor-pointer`}
            >
              <div className={`w-12 h-12 rounded-xl ${feature.iconBg} flex items-center justify-center mb-4`}>
                <feature.icon className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">
                {feature.title}
              </h3>
              <p className="text-slate-600 text-sm leading-relaxed mb-4">
                {feature.description}
              </p>
              <Button
                variant="ghost"
                size="sm"
                className="text-slate-900 hover:text-alfie-mint hover:bg-white/50 p-0 h-auto font-semibold group/btn"
                onClick={(e) => { e.stopPropagation(); handleTry(feature.title); }}
              >
                Découvrir
                <ArrowRight className="ml-1 h-4 w-4 group-hover/btn:translate-x-1 transition-transform" />
              </Button>
            </motion.div>
          ))}
        </div>
      </div>
    </motion.section>
  );
}

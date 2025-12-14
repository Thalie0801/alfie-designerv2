import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ArrowRight, Palette, Zap, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { trackEvent } from "@/utils/trackEvent";

const features = [
  {
    icon: Palette,
    title: "Brand Kit intelligent",
    description: "Crée ton identité visuelle en 1 minute. Couleurs, fonts, ton de voix... Alfie mémorise tout.",
    gradient: "from-alfie-mint/30 to-alfie-mint/10",
    iconBg: "bg-alfie-mint/20 text-alfie-mint",
  },
  {
    icon: Zap,
    title: "Génération ultra-rapide",
    description: "Des visuels pro en quelques secondes. Images, vidéos, carrousels... tout est automatisé.",
    gradient: "from-alfie-lilac/30 to-alfie-lilac/10",
    iconBg: "bg-alfie-lilac/20 text-alfie-lilac",
  },
  {
    icon: Sparkles,
    title: "IA créative avancée",
    description: "Des résultats uniques et brandés. Alfie comprend ta marque et génère du contenu cohérent.",
    gradient: "from-alfie-pink/30 to-alfie-pink/10",
    iconBg: "bg-alfie-pink/20 text-alfie-pink",
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
            Simple. Rapide. Puissant.
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Tout ce dont tu as besoin pour créer du contenu qui convertit.
          </p>
        </motion.div>

        <div className="space-y-4 sm:space-y-6">
          {features.map((feature, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, x: idx % 2 === 0 ? -40 : 40 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: idx * 0.15 }}
              onClick={() => handleTry(feature.title)}
              className={`group flex flex-row items-center gap-3 sm:gap-6 p-3 sm:p-6 rounded-2xl sm:rounded-3xl bg-gradient-to-r ${feature.gradient} border border-slate-200/50 hover:shadow-xl transition-all cursor-pointer`}
            >
              {/* Image placeholder */}
              <div className="w-16 h-16 sm:w-48 lg:w-64 sm:aspect-auto flex-shrink-0 rounded-xl sm:rounded-2xl bg-white shadow-lg overflow-hidden flex items-center justify-center">
                <div className={`w-10 h-10 sm:w-20 sm:h-20 rounded-xl sm:rounded-2xl ${feature.iconBg} flex items-center justify-center`}>
                  <feature.icon className="h-5 w-5 sm:h-10 sm:w-10" />
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 flex flex-col justify-center min-w-0">
                <h3 className="text-base sm:text-xl lg:text-2xl font-bold text-slate-900 mb-0.5 sm:mb-2">
                  {feature.title}
                </h3>
                <p className="text-slate-600 text-xs sm:text-base leading-relaxed line-clamp-2 sm:line-clamp-none mb-0 sm:mb-4">
                  {feature.description}
                </p>
                <div className="hidden sm:block">
                  <Button
                    variant="ghost"
                    className="text-slate-900 hover:text-alfie-mint hover:bg-white/50 p-0 h-auto font-semibold group/btn"
                    onClick={(e) => { e.stopPropagation(); handleTry(feature.title); }}
                  >
                    Essayer maintenant 
                    <ArrowRight className="ml-2 h-4 w-4 group-hover/btn:translate-x-1 transition-transform" />
                  </Button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </motion.section>
  );
}

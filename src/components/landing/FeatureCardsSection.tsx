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
    <section className="px-4 py-16 sm:py-24 sm:px-6 lg:px-8 bg-gradient-to-b from-white to-slate-50">
      <div className="mx-auto max-w-5xl">
        <div className="text-center mb-12">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-slate-900 mb-4">
            Simple. Rapide. Puissant.
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Tout ce dont tu as besoin pour créer du contenu qui convertit.
          </p>
        </div>

        <div className="space-y-6">
          {features.map((feature, idx) => (
            <div
              key={idx}
              className={`group flex flex-col sm:flex-row items-stretch gap-6 p-6 rounded-3xl bg-gradient-to-r ${feature.gradient} border border-slate-200/50 hover:shadow-xl transition-all`}
            >
              {/* Image placeholder */}
              <div className="sm:w-48 lg:w-64 aspect-square sm:aspect-auto flex-shrink-0 rounded-2xl bg-white shadow-lg overflow-hidden flex items-center justify-center">
                <div className={`w-20 h-20 rounded-2xl ${feature.iconBg} flex items-center justify-center`}>
                  <feature.icon className="h-10 w-10" />
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 flex flex-col justify-center">
                <h3 className="text-xl sm:text-2xl font-bold text-slate-900 mb-2">
                  {feature.title}
                </h3>
                <p className="text-slate-600 mb-4 leading-relaxed">
                  {feature.description}
                </p>
                <div>
                  <Button
                    variant="ghost"
                    className="text-slate-900 hover:text-alfie-mint hover:bg-white/50 p-0 h-auto font-semibold group/btn"
                    onClick={() => handleTry(feature.title)}
                  >
                    Essayer maintenant 
                    <ArrowRight className="ml-2 h-4 w-4 group-hover/btn:translate-x-1 transition-transform" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

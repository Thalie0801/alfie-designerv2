import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ArrowRight, Image, Layers, Film, Package, Zap, Video } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { trackEvent } from "@/utils/trackEvent";

const studios = [
  {
    badge: "Solo",
    title: "Studio Solo",
    description: "Génère un asset à la fois avec précision.",
    features: [
      { icon: Image, label: "Image unique" },
      { icon: Layers, label: "Carrousel" },
      { icon: Video, label: "Vidéo courte" },
    ],
    gradient: "from-alfie-mint/20 to-teal-500/10",
    borderColor: "border-alfie-mint/40",
    badgeColor: "bg-alfie-mint text-slate-900",
    cta: "Essayer Solo",
    link: "/start",
  },
  {
    badge: "Multi",
    title: "Studio Multi",
    description: "Crée des contenus multi-scènes et des packs complets.",
    features: [
      { icon: Film, label: "Mini-Film (multi-scènes)" },
      { icon: Package, label: "Pack Campagne" },
      { icon: Zap, label: "Lancement, Promo, Evergreen" },
    ],
    gradient: "from-alfie-lilac/20 to-purple-500/10",
    borderColor: "border-alfie-lilac/40",
    badgeColor: "bg-alfie-lilac text-slate-900",
    cta: "Essayer Multi",
    link: "/start",
  },
];

export function StudiosSection() {
  const navigate = useNavigate();

  const handleClick = (studio: string, link: string) => {
    trackEvent("studios_section_click", { studio });
    navigate(link);
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
            2 Studios, infini de possibilités
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Choisis ton mode selon ton besoin.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-6">
          {studios.map((studio, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: idx * 0.15 }}
              className={`relative bg-gradient-to-br ${studio.gradient} border-2 ${studio.borderColor} rounded-3xl p-6 sm:p-8 hover:shadow-xl transition-all group cursor-pointer`}
              onClick={() => handleClick(studio.badge, studio.link)}
            >
              {/* Badge */}
              <span className={`absolute -top-3 left-6 px-4 py-1 rounded-full text-sm font-bold ${studio.badgeColor}`}>
                {studio.badge}
              </span>

              <h3 className="text-xl sm:text-2xl font-bold text-slate-900 mt-2 mb-2">
                {studio.title}
              </h3>
              <p className="text-slate-600 mb-6">{studio.description}</p>

              <div className="space-y-3 mb-6">
                {studio.features.map((feature, fIdx) => (
                  <div key={fIdx} className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-white/80 shadow-sm flex items-center justify-center">
                      <feature.icon className="w-5 h-5 text-slate-700" />
                    </div>
                    <span className="font-medium text-slate-800">{feature.label}</span>
                  </div>
                ))}
              </div>

              <Button
                variant="ghost"
                className="text-slate-900 hover:text-alfie-mint font-semibold p-0 h-auto group/btn"
                onClick={(e) => { e.stopPropagation(); handleClick(studio.badge, studio.link); }}
              >
                {studio.cta}
                <ArrowRight className="ml-2 h-4 w-4 group-hover/btn:translate-x-1 transition-transform" />
              </Button>
            </motion.div>
          ))}
        </div>
      </div>
    </motion.section>
  );
}

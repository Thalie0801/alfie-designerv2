import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Image, Video, Layers, Layout, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { trackEvent } from "@/utils/trackEvent";

type Category = "images" | "videos" | "carousels" | "stories";

const categories = [
  { id: "images" as Category, label: "Images", icon: Image },
  { id: "videos" as Category, label: "Vidéos", icon: Video },
  { id: "carousels" as Category, label: "Carrousels", icon: Layers },
  { id: "stories" as Category, label: "Stories", icon: Layout },
];

const galleryItems: Record<Category, { title: string; description: string }[]> = {
  images: [
    { title: "Post Instagram", description: "Format carré 1:1 optimisé" },
    { title: "Bannière LinkedIn", description: "Professionnel et impactant" },
    { title: "Miniature YouTube", description: "Accroche visuelle 16:9" },
    { title: "Pinterest Pin", description: "Format vertical 2:3" },
    { title: "Facebook Cover", description: "Image de couverture" },
    { title: "Twitter Header", description: "Bannière de profil" },
  ],
  videos: [
    { title: "Reel Instagram", description: "Vidéo courte 9:16" },
    { title: "Story animée", description: "Motion design percutant" },
    { title: "TikTok", description: "Format vertical engageant" },
    { title: "Shorts YouTube", description: "Contenu snackable" },
    { title: "Intro vidéo", description: "Branding animé" },
    { title: "Promo produit", description: "Mise en valeur animée" },
  ],
  carousels: [
    { title: "Carrousel éducatif", description: "5-10 slides pédagogiques" },
    { title: "Carrousel produit", description: "Showcase de produits" },
    { title: "Carrousel tips", description: "Conseils en slides" },
    { title: "Carrousel story", description: "Narration visuelle" },
    { title: "Carrousel before/after", description: "Transformation" },
    { title: "Carrousel liste", description: "Top 5, Top 10..." },
  ],
  stories: [
    { title: "Story promo", description: "Annonce flash" },
    { title: "Story Q&A", description: "Questions interactives" },
    { title: "Story sondage", description: "Engagement poll" },
    { title: "Story teaser", description: "Avant-première" },
    { title: "Story behind", description: "Coulisses" },
    { title: "Story citation", description: "Quote inspirante" },
  ],
};

export function CategoryGallerySection() {
  const navigate = useNavigate();
  const [activeCategory, setActiveCategory] = useState<Category>("images");

  const handleTry = (item: string) => {
    trackEvent("gallery_try_click", { item, category: activeCategory });
    navigate("/start");
  };

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
            Tout ce que tu peux créer
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Images, vidéos, carrousels, stories... Alfie génère tout pour toi.
          </p>
        </motion.div>

        <div className="flex flex-col lg:flex-row gap-8">
          {/* Sidebar categories */}
          <motion.div 
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="lg:w-48 flex lg:flex-col gap-2 overflow-x-auto lg:overflow-visible pb-2 lg:pb-0"
          >
            {categories.map((cat, idx) => (
              <motion.button
                key={cat.id}
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: idx * 0.1 }}
                onClick={() => setActiveCategory(cat.id)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all whitespace-nowrap ${
                  activeCategory === cat.id
                    ? "bg-slate-900 text-white shadow-lg"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                <cat.icon className="h-5 w-5 flex-shrink-0" />
                <span className="font-medium">{cat.label}</span>
              </motion.button>
            ))}
          </motion.div>

          {/* Gallery grid */}
          <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {galleryItems[activeCategory].map((item, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: idx * 0.05 }}
                className="group bg-white border border-slate-200 rounded-2xl overflow-hidden hover:shadow-xl hover:border-alfie-mint/50 transition-all"
              >
                {/* Placeholder image */}
                <div className="aspect-[4/3] bg-gradient-to-br from-slate-100 to-slate-50 relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-br from-alfie-mint/20 via-transparent to-alfie-lilac/20" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-16 h-16 rounded-2xl bg-white/80 shadow-lg flex items-center justify-center">
                      {activeCategory === "images" && <Image className="h-8 w-8 text-slate-400" />}
                      {activeCategory === "videos" && <Video className="h-8 w-8 text-slate-400" />}
                      {activeCategory === "carousels" && <Layers className="h-8 w-8 text-slate-400" />}
                      {activeCategory === "stories" && <Layout className="h-8 w-8 text-slate-400" />}
                    </div>
                  </div>
                </div>

                {/* Content */}
                <div className="p-4">
                  <h3 className="font-semibold text-slate-900 mb-1">{item.title}</h3>
                  <p className="text-sm text-slate-500 mb-3">{item.description}</p>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-alfie-mint hover:text-alfie-pink hover:bg-alfie-mint/10 p-0 h-auto font-medium"
                    onClick={() => handleTry(item.title)}
                  >
                    Essayer <ArrowRight className="ml-1 h-4 w-4" />
                  </Button>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </motion.section>
  );
}

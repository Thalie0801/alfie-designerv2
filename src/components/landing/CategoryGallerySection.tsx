import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Image, Video, Layers, Layout, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { trackEvent } from "@/utils/trackEvent";

// Images locales de la galerie
import gallerySpecialFetes from "@/assets/gallery/gallery-special-fetes.png";
import galleryZenitude from "@/assets/gallery/gallery-zenitude.png";
import gallerySenteurs from "@/assets/gallery/gallery-senteurs.png";
import galleryCoiffeur from "@/assets/gallery/gallery-coiffeur.png";
import galleryCafe from "@/assets/gallery/gallery-cafe.jpeg";
import galleryDecor from "@/assets/gallery/gallery-decor.png";

// Carrousels locaux
import carouselSkincare from "@/assets/gallery/carousel-skincare.jpeg";
import carouselCandle from "@/assets/gallery/carousel-candle.png";
import carouselCoffee from "@/assets/gallery/carousel-coffee.png";
import carouselSpa from "@/assets/gallery/carousel-spa.png";
import carouselWatch from "@/assets/gallery/carousel-watch.png";
import carouselFurniture from "@/assets/gallery/carousel-furniture.png";

// Stories locales
import storyFurniture from "@/assets/gallery/story-furniture.png";
import storyCandle from "@/assets/gallery/story-candle.png";
import storyCoffee from "@/assets/gallery/story-coffee.png";
import storySpa from "@/assets/gallery/story-spa.png";
import storyRing from "@/assets/gallery/story-ring.png";
import storySilk from "@/assets/gallery/story-silk.png";

type Category = "images" | "videos" | "carousels" | "stories";

const categories = [
  { id: "images" as Category, label: "Images", icon: Image },
  { id: "videos" as Category, label: "Vidéos", icon: Video },
  { id: "carousels" as Category, label: "Carrousels", icon: Layers },
  { id: "stories" as Category, label: "Stories", icon: Layout },
];

// Mapping des images par catégorie
const categoryImages: Record<Category, (string | null)[]> = {
  images: [
    gallerySpecialFetes,  // Promo épilation
    galleryZenitude,      // Spa bien-être
    gallerySenteurs,      // Bougies parfumées
    galleryCoiffeur,      // Salon coiffure
    galleryCafe,          // Coffee shop
    galleryDecor,         // Promo mobilier
  ],
  videos: [null, null, null, null, null, null],
  carousels: [
    carouselSkincare,   // Crème hydratante
    carouselCandle,     // Bougie parfumée
    carouselCoffee,     // Café premium
    carouselSpa,        // Spa bien-être
    carouselWatch,      // Montre luxe
    carouselFurniture,  // Mobilier design
  ],
  stories: [
    storyFurniture,  // Mobilier moderne
    storyCandle,     // Bougie parfumée
    storyCoffee,     // Café premium
    storySpa,        // Spa bien-être
    storyRing,       // Bijou tech
    storySilk,       // Foulard soie
  ],
};

const galleryItems: Record<Category, { title: string; description: string }[]> = {
  images: [
    { title: "Post Instagram", description: "Format carré 1:1 optimisé" },
    { title: "Bannière LinkedIn", description: "Professionnel et impactant" },
    { title: "Miniature YouTube", description: "Accroche visuelle 16:9" },
    { title: "Pinterest Pin", description: "Format vertical 2:3" },
    { title: "Facebook Cover", description: "Image de couverture" },
    { title: "Pinterest Cover", description: "Bannière de profil" },
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
    { title: "Carrousel Skincare", description: "Crème & soins visage" },
    { title: "Carrousel Candles", description: "Bougies parfumées" },
    { title: "Carrousel Coffee", description: "Café de spécialité" },
    { title: "Carrousel Spa", description: "Bien-être & relaxation" },
    { title: "Carrousel Watches", description: "Montres de luxe" },
    { title: "Carrousel Furniture", description: "Mobilier design" },
  ],
  stories: [
    { title: "Story Furniture", description: "Mobilier moderne" },
    { title: "Story Candle", description: "Bougie parfumée" },
    { title: "Story Coffee", description: "Café de spécialité" },
    { title: "Story Spa", description: "Bien-être & relaxation" },
    { title: "Story Ring", description: "Bijou tech lumineux" },
    { title: "Story Silk", description: "Foulard édition limitée" },
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

        <div className="flex flex-col lg:flex-row gap-4 sm:gap-8">
          {/* Sidebar categories - horizontal scroll on mobile */}
          <motion.div 
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="lg:w-48 flex lg:flex-col gap-1.5 sm:gap-2 overflow-x-auto lg:overflow-visible pb-2 lg:pb-0 -mx-4 px-4 sm:mx-0 sm:px-0"
          >
            {categories.map((cat, idx) => (
              <motion.button
                key={cat.id}
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: idx * 0.1 }}
                onClick={() => setActiveCategory(cat.id)}
                className={`flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg sm:rounded-xl text-left transition-all whitespace-nowrap min-h-[44px] ${
                  activeCategory === cat.id
                    ? "bg-slate-900 text-white shadow-lg"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                <cat.icon className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" />
                <span className="font-medium text-sm sm:text-base">{cat.label}</span>
              </motion.button>
            ))}
          </motion.div>

          {/* Gallery grid - 2 cols on mobile, 3 on desktop */}
          <div className="flex-1 grid grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-4">
            {galleryItems[activeCategory].slice(0, 6).map((item, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: idx * 0.05 }}
                onClick={() => handleTry(item.title)}
                className="group bg-white border border-slate-200 rounded-xl sm:rounded-2xl overflow-hidden hover:shadow-xl hover:border-alfie-mint/50 transition-all cursor-pointer"
              >
                {/* Image ou placeholder */}
                <div className="aspect-[4/3] bg-gradient-to-br from-slate-100 to-slate-50 relative overflow-hidden">
                  {categoryImages[activeCategory][idx] ? (
                    <>
                      <img 
                        src={categoryImages[activeCategory][idx]!} 
                        alt={item.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                      <div className="absolute bottom-1 right-1 sm:bottom-2 sm:right-2 bg-black/60 backdrop-blur-sm text-white text-[9px] sm:text-xs px-1 sm:px-2 py-0.5 rounded-full">
                        Made with Alfie
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="absolute inset-0 bg-gradient-to-br from-alfie-mint/20 via-transparent to-alfie-lilac/20" />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-10 h-10 sm:w-16 sm:h-16 rounded-xl sm:rounded-2xl bg-white/80 shadow-lg flex items-center justify-center">
                          {activeCategory === "images" && <Image className="h-5 w-5 sm:h-8 sm:w-8 text-slate-400" />}
                          {activeCategory === "videos" && <Video className="h-5 w-5 sm:h-8 sm:w-8 text-slate-400" />}
                          {activeCategory === "carousels" && <Layers className="h-5 w-5 sm:h-8 sm:w-8 text-slate-400" />}
                          {activeCategory === "stories" && <Layout className="h-5 w-5 sm:h-8 sm:w-8 text-slate-400" />}
                        </div>
                      </div>
                    </>
                  )}
                </div>

                {/* Content */}
                <div className="p-2 sm:p-4">
                  <h3 className="font-semibold text-slate-900 text-xs sm:text-base mb-0.5 sm:mb-1 truncate">{item.title}</h3>
                  <p className="text-[10px] sm:text-sm text-slate-500 mb-1 sm:mb-3 line-clamp-1 sm:line-clamp-2">{item.description}</p>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-alfie-mint hover:text-alfie-pink hover:bg-alfie-mint/10 p-0 h-auto font-medium text-xs sm:text-sm hidden sm:inline-flex"
                    onClick={(e) => { e.stopPropagation(); handleTry(item.title); }}
                  >
                    Essayer <ArrowRight className="ml-1 h-3 w-3 sm:h-4 sm:w-4" />
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

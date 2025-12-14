import { useState, useRef } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Play, Sparkles, X, ChevronLeft, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { trackEvent } from "@/utils/trackEvent";

// Imports des images
import postInstagram from "@/assets/demo/post-instagram.png";
import story16x9 from "@/assets/demo/story-16-9.png";
import avantImage from "@/assets/demo/avant.png";
import apresImage from "@/assets/demo/apres.png";

// Images du carousel
import carouselSlide1 from "@/assets/demo/carousel/slide-01.png";
import carouselSlide2 from "@/assets/demo/carousel/slide-02.png";
import carouselSlide3 from "@/assets/demo/carousel/slide-03.png";
import carouselSlide4 from "@/assets/demo/carousel/slide-04.png";
import carouselSlide5 from "@/assets/demo/carousel/slide-05.png";

const carouselSlides = [
  { id: 1, image: carouselSlide1, alt: "Slide 1" },
  { id: 2, image: carouselSlide2, alt: "Slide 2" },
  { id: 3, image: carouselSlide3, alt: "Slide 3" },
  { id: 4, image: carouselSlide4, alt: "Slide 4" },
  { id: 5, image: carouselSlide5, alt: "Slide 5" },
];

export function DemoSection() {
  const navigate = useNavigate();
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const carouselRef = useRef<HTMLDivElement>(null);

  const handleCtaClick = () => {
    trackEvent("demo_cta_click");
    navigate("/start");
  };

  const openLightbox = (image: string) => {
    setLightboxImage(image);
  };

  const closeLightbox = () => {
    setLightboxImage(null);
  };

  const scrollCarousel = (direction: 'left' | 'right') => {
    if (carouselRef.current) {
      const scrollAmount = 300;
      carouselRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  return (
    <motion.section 
      id="demo" 
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true, margin: "-100px" }}
      transition={{ duration: 0.6 }}
      className="px-4 py-16 sm:py-24 sm:px-6 lg:px-8 bg-gradient-to-b from-slate-50 to-white"
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
            Une démo rapide (30 sec)
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Regarde comment Alfie transforme une idée en visuels brandés.
          </p>
        </motion.div>

        {/* Video placeholder */}
        <motion.div 
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="relative rounded-2xl overflow-hidden bg-gradient-to-br from-slate-900 to-slate-800 aspect-video mb-12 shadow-xl"
        >
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex flex-col items-center gap-4 text-white/80">
              <div className="h-20 w-20 rounded-full bg-white/10 backdrop-blur flex items-center justify-center border border-white/20 cursor-pointer hover:bg-white/20 transition-colors">
                <Play className="h-8 w-8 ml-1" />
              </div>
              <span className="text-sm">Démo vidéo (bientôt)</span>
            </div>
          </div>
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent pointer-events-none" />
        </motion.div>

        {/* Gallery of real results - New Layout */}
        <motion.div 
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="mb-12"
        >
          <h3 className="text-lg font-semibold text-slate-900 text-center mb-6">
            Exemples de résultats
          </h3>
          
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6">
            {/* Image 2: Story en 9:16 - format portrait */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.1 }}
              onClick={() => openLightbox(story16x9)}
              className="group cursor-pointer bg-white rounded-xl sm:rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-lg transition-all"
            >
              <div className="aspect-[9/16] max-h-[280px] sm:max-h-[400px] bg-gradient-to-br from-alfie-mint/20 to-alfie-lilac/20 relative overflow-hidden">
                <img 
                  src={story16x9} 
                  alt="Story 9:16"
                  loading="lazy"
                  className="w-full h-full object-cover object-[center_15%] group-hover:scale-105 transition-transform duration-300"
                />
                <div className="absolute bottom-1 right-1 sm:bottom-2 sm:right-2 bg-black/60 backdrop-blur-sm text-white text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full">
                  Made with Alfie
                </div>
              </div>
              <div className="p-2 sm:p-4">
                <p className="font-medium text-slate-900 text-sm sm:text-base">Story (9:16)</p>
                <p className="text-[10px] sm:text-xs text-slate-500 mt-0.5 sm:mt-1 hidden sm:block">Généré avec Alfie + Brand Kit</p>
              </div>
            </motion.div>

            {/* Image 1: Post Instagram */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.2 }}
              onClick={() => openLightbox(postInstagram)}
              className="group cursor-pointer bg-white rounded-xl sm:rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-lg transition-all"
            >
              <div className="aspect-square bg-gradient-to-br from-alfie-mint/20 to-alfie-lilac/20 relative overflow-hidden">
                <img 
                  src={postInstagram} 
                  alt="Post Instagram"
                  loading="lazy"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                <div className="absolute bottom-1 right-1 sm:bottom-2 sm:right-2 bg-black/60 backdrop-blur-sm text-white text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full">
                  Made with Alfie
                </div>
              </div>
              <div className="p-2 sm:p-4">
                <p className="font-medium text-slate-900 text-sm sm:text-base">Post Instagram</p>
                <p className="text-[10px] sm:text-xs text-slate-500 mt-0.5 sm:mt-1 hidden sm:block">Généré avec Alfie + Brand Kit</p>
              </div>
            </motion.div>

            {/* Carousel Card with swipeable images */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="col-span-2 lg:col-span-1 bg-white rounded-xl sm:rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-lg transition-all"
            >
              <div className="aspect-[4/5] max-h-[280px] sm:max-h-none bg-gradient-to-br from-alfie-mint/20 to-alfie-lilac/20 relative overflow-hidden">
                <div 
                  ref={carouselRef}
                  className="flex overflow-x-auto snap-x snap-mandatory scrollbar-hide h-full"
                  style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                >
                  {carouselSlides.map((slide) => (
                    <div 
                      key={slide.id}
                      className="flex-shrink-0 w-full h-full snap-center relative cursor-pointer"
                      onClick={() => openLightbox(slide.image)}
                    >
                      <img 
                        src={slide.image} 
                        alt={slide.alt}
                        loading="lazy"
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute bottom-1 right-1 sm:bottom-2 sm:right-2 bg-black/60 backdrop-blur-sm text-white text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full">
                        Made with Alfie
                      </div>
                    </div>
                  ))}
                </div>
                
                <button 
                  onClick={(e) => { e.stopPropagation(); scrollCarousel('left'); }}
                  className="absolute left-1 sm:left-2 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white rounded-full p-2 sm:p-2.5 shadow-md transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                >
                  <ChevronLeft className="h-5 w-5 sm:h-6 sm:w-6 text-slate-700" />
                </button>
                <button 
                  onClick={(e) => { e.stopPropagation(); scrollCarousel('right'); }}
                  className="absolute right-1 sm:right-2 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white rounded-full p-2 sm:p-2.5 shadow-md transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                >
                  <ChevronRight className="h-5 w-5 sm:h-6 sm:w-6 text-slate-700" />
                </button>

                <div className="absolute bottom-6 sm:bottom-10 left-1/2 -translate-x-1/2 flex gap-1.5">
                  {carouselSlides.map((_, idx) => (
                    <div 
                      key={idx}
                      className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-white/60"
                    />
                  ))}
                </div>
              </div>
              <div className="p-2 sm:p-4">
                <p className="font-medium text-slate-900 text-sm sm:text-base">Carrousel</p>
                <p className="text-[10px] sm:text-xs text-slate-500 mt-0.5 sm:mt-1">Glisse pour voir les slides →</p>
              </div>
            </motion.div>
          </div>
        </motion.div>

        {/* Before/After */}
        <motion.div 
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="mb-12"
        >
          <h3 className="text-lg font-semibold text-slate-900 text-center mb-6">
            Avant / Après Brand Kit
          </h3>
          <div className="grid grid-cols-2 gap-2 sm:gap-4 max-w-2xl mx-auto">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              onClick={() => openLightbox(avantImage)}
              className="cursor-pointer group"
            >
              <div className="aspect-square rounded-lg sm:rounded-xl overflow-hidden border-2 border-slate-300 bg-slate-100 relative">
                <img 
                  src={avantImage} 
                  alt="Avant - Sans Brand Kit"
                  loading="lazy"
                  className="w-full h-full object-cover opacity-70 group-hover:opacity-100 transition-opacity"
                />
                <div className="absolute bottom-1 right-1 sm:bottom-2 sm:right-2 bg-black/60 backdrop-blur-sm text-white text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full">
                  Made with Alfie
                </div>
              </div>
              <p className="text-center text-xs sm:text-sm text-slate-500 mt-1 sm:mt-2 font-medium">
                Sans Brand Kit
              </p>
            </motion.div>
            
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              onClick={() => openLightbox(apresImage)}
              className="cursor-pointer group"
            >
              <div className="aspect-square rounded-lg sm:rounded-xl overflow-hidden border-2 border-alfie-mint bg-alfie-mint/10 relative">
                <img 
                  src={apresImage} 
                  alt="Après - Avec Brand Kit"
                  loading="lazy"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                />
                <div className="absolute bottom-1 right-1 sm:bottom-2 sm:right-2 bg-black/60 backdrop-blur-sm text-white text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full">
                  Made with Alfie
                </div>
              </div>
              <p className="text-center text-xs sm:text-sm text-alfie-mint mt-1 sm:mt-2 font-semibold">
                Avec Brand Kit ✨
              </p>
            </motion.div>
          </div>
        </motion.div>

        {/* CTA */}
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="text-center"
        >
          <Button
            size="lg"
            className="rounded-full bg-alfie-mint px-8 py-3 text-base font-semibold text-slate-900 shadow-md hover:bg-alfie-pink"
            onClick={handleCtaClick}
          >
            <Sparkles className="mr-2 h-5 w-5" />
            Créer mon Brand Kit (1 min)
          </Button>
          <p className="text-xs text-slate-500 mt-3">
            3 visuels gratuits en 5 min. Sans carte.
          </p>
        </motion.div>
      </div>

      {/* Lightbox Modal */}
      {lightboxImage && (
        <div 
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={closeLightbox}
        >
          <button 
            className="absolute top-4 right-4 text-white/80 hover:text-white"
            onClick={closeLightbox}
          >
            <X className="h-8 w-8" />
          </button>
          <img 
            src={lightboxImage} 
            alt="Preview"
            className="max-w-full max-h-[90vh] object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </motion.section>
  );
}

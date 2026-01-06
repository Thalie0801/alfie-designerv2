import { useRef, useState, useEffect } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { trackEvent } from "@/utils/trackEvent";

// Demo images
import storyCreator from "@/assets/demo/story-creator.jpeg";
import postParfum from "@/assets/demo/post-parfum-alfie.png";
import carouselParfum from "@/assets/demo/carousel-parfum.png";
import pinterestKoi from "@/assets/demo/pinterest-koi.jpeg";

const heroAdjectives = ["convertit", "impacte", "engage"];

export function HeroVideoSection() {
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  const [phraseIndex, setPhraseIndex] = useState(0);
  
  // Word cycling animation
  useEffect(() => {
    const interval = setInterval(() => {
      setPhraseIndex((prev) => (prev + 1) % heroAdjectives.length);
    }, 2500);
    return () => clearInterval(interval);
  }, []);
  
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end start"]
  });

  // Animations au scroll - cards disparaissent, vidéo descend et s'agrandit
  const card1X = useTransform(scrollYProgress, [0, 0.4], [0, -300]);
  const card2X = useTransform(scrollYProgress, [0, 0.4], [0, 300]);
  const card3X = useTransform(scrollYProgress, [0, 0.4], [0, -250]);
  const card4X = useTransform(scrollYProgress, [0, 0.4], [0, 250]);
  const cardsOpacity = useTransform(scrollYProgress, [0, 0.3], [1, 0]);
  
  // Video: descend et s'agrandit (inversé)
  const videoScale = useTransform(scrollYProgress, [0, 0.5], [0.6, 1.3]);
  const videoY = useTransform(scrollYProgress, [0, 0.5], [0, 150]);
  
  // Scroll indicator fade out
  const scrollIndicatorOpacity = useTransform(scrollYProgress, [0, 0.2], [1, 0]);

  const handleCta = () => {
    trackEvent("hero_cta_click");
    navigate("/start");
  };

  return (
    <section 
      ref={containerRef}
      className="relative min-h-[150vh] overflow-hidden bg-gradient-to-b from-white via-slate-50 to-white"
    >
      {/* Subtle gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-alfie-mint/5 via-transparent to-alfie-lilac/5 pointer-events-none" />
      
      {/* Content container - sticky */}
      <div className="sticky top-0 h-screen flex flex-col items-center justify-center px-4 sm:px-6 pt-16">
        
        {/* Title - with animated word cycling */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="text-center mb-6 z-20"
        >
          <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-slate-900 leading-tight pb-2 sm:pb-4">
            Crée du contenu qui
            <span className="relative inline-flex items-baseline ml-1 sm:ml-2">
              <motion.span 
                key={phraseIndex}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
                className="bg-gradient-to-r from-alfie-mint to-alfie-lilac bg-clip-text text-transparent"
              >
                {heroAdjectives[phraseIndex]}
              </motion.span>
              <span className="ml-1 h-6 sm:h-10 w-[2px] sm:w-[3px] animate-pulse bg-alfie-mint rounded-full" />
            </span>
          </h1>
          <p className="text-base sm:text-lg md:text-xl text-slate-600 max-w-2xl mx-auto mt-3 sm:mt-6 px-2">
            Génère des visuels pro pour tes réseaux sociaux en quelques clics.
          </p>
        </motion.div>

        {/* CTA Button - BELOW title */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="mb-4 z-20"
        >
          <Button
            size="lg"
            className="rounded-full bg-alfie-mint px-8 py-4 text-lg font-semibold text-slate-900 shadow-lg hover:bg-alfie-pink hover:scale-105 transition-all flex flex-col items-center gap-0"
            onClick={handleCta}
          >
            <span className="flex items-center">
              <Sparkles className="mr-2 h-5 w-5" />
              ✅ Créer mon Pack Gratuit
            </span>
            <span className="text-xs font-normal opacity-80">(visuels prêts à poster)</span>
          </Button>
          <p className="text-center text-sm text-slate-500 mt-3">
            Brand Kit inclus · 1 minute · Sans carte bancaire
          </p>
        </motion.div>

        {/* Scroll indicator - below CTA */}
        <motion.div
          style={{ opacity: scrollIndicatorOpacity }}
          animate={{ y: [0, 8, 0] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="mb-6 text-slate-400 flex flex-col items-center gap-1 z-20"
        >
          <div className="w-5 h-7 border-2 border-slate-300 rounded-full flex items-start justify-center p-1">
            <motion.div
              animate={{ y: [0, 8, 0] }}
              transition={{ duration: 1.5, repeat: Infinity }}
              className="w-1 h-1.5 bg-slate-400 rounded-full"
            />
          </div>
        </motion.div>

        {/* Video + 4 floating cards container */}
        <div className="relative w-full max-w-6xl mx-auto flex items-center justify-center h-[35vh] sm:h-[45vh]">
          {/* Card 1: Story (top-left) */}
          <motion.div
            style={{ x: card1X, opacity: cardsOpacity }}
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.5 }}
            className="absolute left-2 sm:left-8 lg:left-16 top-[20%] sm:top-1/2 sm:-translate-y-1/2 w-14 sm:w-28 lg:w-36 aspect-[9/16] rounded-lg sm:rounded-xl overflow-hidden shadow-lg sm:shadow-xl z-0 border border-slate-200 -rotate-3 sm:rotate-0"
          >
            <img src={storyCreator} alt="Story" className="w-full h-full object-cover" />
            <div className="absolute bottom-0.5 left-0.5 sm:bottom-1 sm:left-1 bg-black/50 text-white text-[9px] sm:text-[10px] px-1 sm:px-1.5 py-0.5 rounded">Story</div>
          </motion.div>

          {/* Card 2: Post (top-right) */}
          <motion.div
            style={{ x: card2X, opacity: cardsOpacity }}
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.6 }}
            className="absolute right-2 sm:right-8 lg:right-16 top-[20%] sm:top-1/2 sm:-translate-y-1/2 w-14 sm:w-28 lg:w-36 aspect-square rounded-lg sm:rounded-xl overflow-hidden shadow-lg sm:shadow-xl z-0 border border-slate-200 rotate-3 sm:rotate-0"
          >
            <img src={postParfum} alt="Post" className="w-full h-full object-cover" />
            <div className="absolute bottom-0.5 left-0.5 sm:bottom-1 sm:left-1 bg-black/50 text-white text-[9px] sm:text-[10px] px-1 sm:px-1.5 py-0.5 rounded">Post</div>
          </motion.div>

          {/* Card 3: Carousel (bottom-left, overlapping) */}
          <motion.div
            style={{ x: card3X, opacity: cardsOpacity }}
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.7 }}
            className="absolute left-6 sm:left-20 lg:left-32 top-[55%] sm:top-[60%] -translate-y-1/2 w-12 sm:w-24 lg:w-32 aspect-[4/5] rounded-lg sm:rounded-xl overflow-hidden shadow-xl sm:shadow-2xl z-5 border-2 border-white -rotate-6 sm:rotate-0"
          >
            <img src={carouselParfum} alt="Carousel" className="w-full h-full object-cover" />
            <div className="absolute bottom-0.5 left-0.5 sm:bottom-1 sm:left-1 bg-black/50 text-white text-[9px] sm:text-[10px] px-1 sm:px-1.5 py-0.5 rounded">Carousel</div>
          </motion.div>

          {/* Card 4: Pinterest (bottom-right, overlapping) */}
          <motion.div
            style={{ x: card4X, opacity: cardsOpacity }}
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.8 }}
            className="absolute right-6 sm:right-20 lg:right-32 top-[55%] sm:top-[60%] -translate-y-1/2 w-12 sm:w-24 lg:w-32 aspect-[2/3] rounded-lg sm:rounded-xl overflow-hidden shadow-xl sm:shadow-2xl z-5 border-2 border-white rotate-6 sm:rotate-0"
          >
            <img src={pinterestKoi} alt="Pinterest" className="w-full h-full object-cover" />
            <div className="absolute bottom-0.5 left-0.5 sm:bottom-1 sm:left-1 bg-black/50 text-white text-[9px] sm:text-[10px] px-1 sm:px-1.5 py-0.5 rounded">Pinterest</div>
          </motion.div>

          {/* Center video - descends and scales up to fullscreen */}
          <motion.div
            style={{ scale: videoScale, y: videoY }}
            className="relative w-full max-w-3xl aspect-video rounded-2xl overflow-hidden shadow-2xl z-10 ring-1 ring-slate-200"
          >
            <video
              src="/videos/hero-background.mp4"
              autoPlay
              loop
              muted
              playsInline
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent pointer-events-none" />
          </motion.div>
        </div>
      </div>
    </section>
  );
}

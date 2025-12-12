import { useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { trackEvent } from "@/utils/trackEvent";

// Demo images
import postInstagram from "@/assets/demo/post-instagram.png";
import story16x9 from "@/assets/demo/story-16-9.png";
import carouselSlide1 from "@/assets/demo/carousel/slide-01.png";
import carouselSlide2 from "@/assets/demo/carousel/slide-02.png";

export function HeroVideoSection() {
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end start"]
  });

  // Animations au scroll - cards disparaissent, vidéo s'agrandit
  const card1X = useTransform(scrollYProgress, [0, 0.4], [0, -300]);
  const card2X = useTransform(scrollYProgress, [0, 0.4], [0, 300]);
  const card3X = useTransform(scrollYProgress, [0, 0.4], [0, -250]);
  const card4X = useTransform(scrollYProgress, [0, 0.4], [0, 250]);
  const cardsOpacity = useTransform(scrollYProgress, [0, 0.3], [1, 0]);
  const videoScale = useTransform(scrollYProgress, [0, 0.5], [0.5, 1]);
  const videoY = useTransform(scrollYProgress, [0, 0.5], [0, -50]);

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
      <div className="sticky top-0 h-screen flex flex-col items-center justify-center px-4 sm:px-6 pt-20">
        {/* Title - visible and well positioned */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="text-center mb-8 z-20"
        >
          <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-slate-900 mb-4 leading-tight">
            Crée du contenu qui
            <span className="bg-gradient-to-r from-alfie-mint to-alfie-lilac bg-clip-text text-transparent"> convertit</span>
          </h1>
          <p className="text-lg sm:text-xl text-slate-600 max-w-2xl mx-auto">
            Génère des visuels pro pour tes réseaux sociaux en quelques clics.
          </p>
        </motion.div>

        {/* Video + 4 floating cards container */}
        <div className="relative w-full max-w-6xl mx-auto flex items-center justify-center h-[50vh]">
          {/* Card 1: Story (back-left) */}
          <motion.div
            style={{ x: card1X, opacity: cardsOpacity }}
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="absolute left-0 sm:left-8 lg:left-16 top-1/2 -translate-y-1/2 w-20 sm:w-28 lg:w-36 aspect-[9/16] rounded-xl overflow-hidden shadow-xl z-0 hidden sm:block border border-slate-200"
          >
            <img src={story16x9} alt="Story" className="w-full h-full object-cover" />
            <div className="absolute bottom-1 left-1 bg-black/50 text-white text-[10px] px-1.5 py-0.5 rounded">Story</div>
          </motion.div>

          {/* Card 2: Post (back-right) */}
          <motion.div
            style={{ x: card2X, opacity: cardsOpacity }}
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="absolute right-0 sm:right-8 lg:right-16 top-1/2 -translate-y-1/2 w-20 sm:w-28 lg:w-36 aspect-square rounded-xl overflow-hidden shadow-xl z-0 hidden sm:block border border-slate-200"
          >
            <img src={postInstagram} alt="Post" className="w-full h-full object-cover" />
            <div className="absolute bottom-1 left-1 bg-black/50 text-white text-[10px] px-1.5 py-0.5 rounded">Post</div>
          </motion.div>

          {/* Card 3: Carousel (front-left, overlapping) */}
          <motion.div
            style={{ x: card3X, opacity: cardsOpacity }}
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="absolute left-8 sm:left-20 lg:left-32 top-[60%] -translate-y-1/2 w-16 sm:w-24 lg:w-32 aspect-[4/5] rounded-xl overflow-hidden shadow-2xl z-5 hidden sm:block border-2 border-white"
          >
            <img src={carouselSlide1} alt="Carousel" className="w-full h-full object-cover" />
            <div className="absolute bottom-1 left-1 bg-black/50 text-white text-[10px] px-1.5 py-0.5 rounded">Carousel</div>
          </motion.div>

          {/* Card 4: Pinterest (front-right, overlapping) */}
          <motion.div
            style={{ x: card4X, opacity: cardsOpacity }}
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.5 }}
            className="absolute right-8 sm:right-20 lg:right-32 top-[60%] -translate-y-1/2 w-16 sm:w-24 lg:w-32 aspect-[2/3] rounded-xl overflow-hidden shadow-2xl z-5 hidden sm:block border-2 border-white"
          >
            <img src={carouselSlide2} alt="Pinterest" className="w-full h-full object-cover" />
            <div className="absolute bottom-1 left-1 bg-black/50 text-white text-[10px] px-1.5 py-0.5 rounded">Pinterest</div>
          </motion.div>

          {/* Center video - Alfie original */}
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

        {/* CTA Button - positioned clearly below */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.6 }}
          className="mt-8 z-20"
        >
          <Button
            size="lg"
            className="rounded-full bg-alfie-mint px-8 py-4 text-lg font-semibold text-slate-900 shadow-lg hover:bg-alfie-pink hover:scale-105 transition-all"
            onClick={handleCta}
          >
            <Sparkles className="mr-2 h-5 w-5" />
            Créer mon Brand Kit
          </Button>
          <p className="text-center text-sm text-slate-500 mt-3">
            Gratuit · 1 minute · Sans carte bancaire
          </p>
        </motion.div>
      </div>

      {/* Scroll indicator - positioned at very bottom */}
      <motion.div
        animate={{ y: [0, 10, 0] }}
        transition={{ duration: 2, repeat: Infinity }}
        className="fixed bottom-6 left-1/2 -translate-x-1/2 text-slate-400 flex flex-col items-center gap-2 z-30"
      >
        <span className="text-xs">Scroll</span>
        <div className="w-5 h-8 border-2 border-slate-300 rounded-full flex items-start justify-center p-1">
          <motion.div
            animate={{ y: [0, 10, 0] }}
            transition={{ duration: 1.5, repeat: Infinity }}
            className="w-1 h-2 bg-slate-400 rounded-full"
          />
        </div>
      </motion.div>
    </section>
  );
}

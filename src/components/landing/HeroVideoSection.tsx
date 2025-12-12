import { useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { trackEvent } from "@/utils/trackEvent";

export function HeroVideoSection() {
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end start"]
  });

  // Animations au scroll
  const leftImageX = useTransform(scrollYProgress, [0, 0.5], [0, -200]);
  const rightImageX = useTransform(scrollYProgress, [0, 0.5], [0, 200]);
  const imageOpacity = useTransform(scrollYProgress, [0, 0.3], [1, 0]);
  const videoScale = useTransform(scrollYProgress, [0, 0.5], [0.7, 1]);

  const handleCta = () => {
    trackEvent("hero_cta_click");
    navigate("/start");
  };

  return (
    <section 
      ref={containerRef}
      className="relative min-h-[120vh] overflow-hidden bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900"
    >
      {/* Background gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-alfie-mint/10 via-transparent to-alfie-lilac/10 pointer-events-none" />
      
      {/* Content container */}
      <div className="sticky top-0 h-screen flex flex-col items-center justify-center px-4 sm:px-6">
        {/* Title */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="text-center mb-8 z-10"
        >
          <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-4 leading-tight">
            Crée du contenu qui
            <span className="bg-gradient-to-r from-alfie-mint to-alfie-lilac bg-clip-text text-transparent"> convertit</span>
          </h1>
          <p className="text-lg sm:text-xl text-white/70 max-w-2xl mx-auto">
            Génère des visuels pro pour tes réseaux sociaux en quelques clics.
          </p>
        </motion.div>

        {/* Video + floating images container */}
        <div className="relative w-full max-w-5xl mx-auto flex items-center justify-center">
          {/* Left floating image */}
          <motion.div
            style={{ x: leftImageX, opacity: imageOpacity }}
            className="absolute left-0 sm:left-4 lg:left-0 w-24 sm:w-32 lg:w-40 aspect-[3/4] rounded-2xl overflow-hidden shadow-2xl z-0 hidden sm:block"
          >
            <div className="w-full h-full bg-gradient-to-br from-alfie-mint/60 to-alfie-pink/60 flex items-center justify-center">
              <span className="text-white/80 text-xs font-medium">Story</span>
            </div>
          </motion.div>

          {/* Center video */}
          <motion.div
            style={{ scale: videoScale }}
            className="relative w-full max-w-3xl aspect-video rounded-2xl overflow-hidden shadow-2xl z-10 ring-1 ring-white/20"
          >
            <video
              src="/videos/hero-demo.mp4"
              autoPlay
              loop
              muted
              playsInline
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent pointer-events-none" />
          </motion.div>

          {/* Right floating image */}
          <motion.div
            style={{ x: rightImageX, opacity: imageOpacity }}
            className="absolute right-0 sm:right-4 lg:right-0 w-24 sm:w-32 lg:w-40 aspect-square rounded-2xl overflow-hidden shadow-2xl z-0 hidden sm:block"
          >
            <div className="w-full h-full bg-gradient-to-br from-alfie-lilac/60 to-alfie-mint/60 flex items-center justify-center">
              <span className="text-white/80 text-xs font-medium">Post</span>
            </div>
          </motion.div>
        </div>

        {/* CTA Button */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="mt-10 z-10"
        >
          <Button
            size="lg"
            className="rounded-full bg-alfie-mint px-8 py-4 text-lg font-semibold text-slate-900 shadow-lg hover:bg-alfie-pink hover:scale-105 transition-all"
            onClick={handleCta}
          >
            <Sparkles className="mr-2 h-5 w-5" />
            Créer mon Brand Kit
          </Button>
          <p className="text-center text-sm text-white/50 mt-3">
            Gratuit · 1 minute · Sans carte bancaire
          </p>
        </motion.div>
      </div>

      {/* Scroll indicator */}
      <motion.div
        animate={{ y: [0, 10, 0] }}
        transition={{ duration: 2, repeat: Infinity }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2 text-white/50 flex flex-col items-center gap-2"
      >
        <span className="text-xs">Scroll pour découvrir</span>
        <div className="w-6 h-10 border-2 border-white/30 rounded-full flex items-start justify-center p-1">
          <motion.div
            animate={{ y: [0, 12, 0] }}
            transition={{ duration: 1.5, repeat: Infinity }}
            className="w-1.5 h-3 bg-white/50 rounded-full"
          />
        </div>
      </motion.div>
    </section>
  );
}

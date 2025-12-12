import { useState, useEffect } from "react";
import { LandingHeader } from "@/components/LandingHeader";
import { HeroTextSection } from "@/components/landing/HeroTextSection";
import { HowItWorksSection } from "@/components/landing/HowItWorksSection";
import { DemoSection } from "@/components/landing/DemoSection";
import { FeaturesSection } from "@/components/landing/FeaturesSection";
import { FreeTrialBlock } from "@/components/landing/FreeTrialBlock";
import { PricingSection } from "@/components/landing/PricingSection";
import { FinalCTA } from "@/components/landing/FinalCTA";
import { LandingFooter } from "@/components/landing/LandingFooter";
import { ProspectBubble } from "@/components/ProspectBubble";
import { useAffiliate } from "@/hooks/useAffiliate";

export default function AlfieLanding() {
  const [videoLoaded, setVideoLoaded] = useState(false);
  
  // Defer affiliate tracking to avoid blocking first paint
  useEffect(() => {
    const timer = setTimeout(() => {
      // Affiliate hook handles tracking internally
    }, 100);
    return () => clearTimeout(timer);
  }, []);
  
  // Initialize affiliate tracking
  useAffiliate();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <LandingHeader />

      {/* SECTION 1 : Image Alfie + vidéo - Fixed height to prevent layout shift */}
      <section className="relative h-[80vh] md:h-screen overflow-hidden" style={{ minHeight: '600px' }}>
        {/* Image Alfie en arrière-plan permanent avec overlay fort */}
        <div className="absolute inset-0">
          <picture>
            <source srcSet="/images/alfie-hero-background.webp" type="image/webp" />
            <img
              src="/images/alfie-hero-background.jpeg"
              alt="Alfie Golden Retriever"
              className="h-full w-full object-cover"
              loading="eager"
              width={1920}
              height={1080}
              // @ts-expect-error - fetchpriority is valid HTML but React types don't recognize it
              fetchpriority="high"
            />
          </picture>
          {/* Overlay sombre très fort sur l'image pour qu'elle soit subtile */}
          <div className="absolute inset-0 bg-black/85" />
        </div>
        
        {/* Vidéo qui s'affiche progressivement par-dessus avec opacité totale */}
        <video
          src="/videos/hero-background.mp4"
          autoPlay
          loop
          muted
          playsInline
          preload="auto"
          width={1920}
          height={1080}
          onLoadedData={() => setVideoLoaded(true)}
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-1000 ${
            videoLoaded ? 'opacity-100' : 'opacity-0'
          }`}
        />
        
        {/* Overlay gradient léger par-dessus la vidéo pour lisibilité du texte */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/30" />
        
        {/* Scroll indicator */}
        <div className={`pointer-events-none absolute bottom-6 md:bottom-10 left-1/2 flex -translate-x-1/2 flex-col items-center gap-2 text-white/90 transition-opacity duration-500 ${
          videoLoaded ? 'opacity-100' : 'opacity-0'
        }`}>
          <span className="text-xs md:text-sm font-medium">Fais défiler pour découvrir Alfie</span>
          <div className="flex h-8 w-8 md:h-9 md:w-9 items-center justify-center rounded-full border-2 border-white/70 text-sm md:text-base animate-bounce">
            ↓
          </div>
        </div>
      </section>

      <HeroTextSection />
      <HowItWorksSection />
      <DemoSection />
      <FeaturesSection />
      <FreeTrialBlock />
      <PricingSection />
      <FinalCTA />
      <LandingFooter />
      <ProspectBubble />
    </div>
  );
}

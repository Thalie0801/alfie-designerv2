import { useState } from "react";
import { LandingHeader } from "@/components/LandingHeader";
import { HeroTextSection } from "@/components/landing/HeroTextSection";
import { HowItWorksSection } from "@/components/landing/HowItWorksSection";
import { FeaturesSection } from "@/components/landing/FeaturesSection";
import { PricingSection } from "@/components/landing/PricingSection";
import { FinalCTA } from "@/components/landing/FinalCTA";
import { LandingFooter } from "@/components/landing/LandingFooter";
import { ProspectBubble } from "@/components/ProspectBubble";

export default function AlfieLanding() {
  const [videoLoaded, setVideoLoaded] = useState(false);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <LandingHeader />

      {/* SECTION 1 : Image Alfie + vidéo */}
      <section className="relative h-[80vh] md:h-screen overflow-hidden">
        {/* Image Alfie en arrière-plan permanent */}
        <img
          src="/images/alfie-hero-background.jpeg"
          alt="Alfie Golden Retriever"
          className="absolute inset-0 h-full w-full object-cover"
        />
        
        {/* Overlay sombre pour lisibilité */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/20 to-black/50" />
        
        {/* Loading skeleton pour la vidéo */}
        {!videoLoaded && (
          <div className="absolute inset-0 bg-black/20 animate-pulse" />
        )}
        
        {/* Vidéo qui s'affiche progressivement par-dessus */}
        <video
          src="/videos/hero-background.mp4"
          autoPlay
          loop
          muted
          playsInline
          preload="auto"
          onLoadedData={() => setVideoLoaded(true)}
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-1000 ${
            videoLoaded ? 'opacity-80' : 'opacity-0'
          }`}
        />
        
        {/* Overlay gradient par-dessus la vidéo */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/40" />
        
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
      <FeaturesSection />
      <PricingSection />
      <FinalCTA />
      <LandingFooter />
      <ProspectBubble />
    </div>
  );
}

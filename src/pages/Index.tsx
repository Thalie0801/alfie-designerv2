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

      {/* SECTION 1 : vidéo immersive */}
      <section className="relative h-screen overflow-hidden bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
        {/* Loading skeleton avec gradient animé */}
        {!videoLoaded && (
          <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 animate-pulse">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(168,85,247,0.15),transparent_50%)]" />
          </div>
        )}
        
        <video
          src="/videos/hero-background.mp4"
          autoPlay
          loop
          muted
          playsInline
          preload="auto"
          onLoadedData={() => setVideoLoaded(true)}
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ${
            videoLoaded ? 'opacity-100' : 'opacity-0'
          }`}
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-black/35" />
        <div className={`pointer-events-none absolute bottom-10 left-1/2 flex -translate-x-1/2 flex-col items-center gap-2 text-white/80 transition-opacity duration-500 ${
          videoLoaded ? 'opacity-100' : 'opacity-0'
        }`}>
          <span className="text-xs md:text-sm">Fais défiler pour découvrir Alfie</span>
          <div className="flex h-9 w-9 items-center justify-center rounded-full border border-white/60 text-base animate-bounce">
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

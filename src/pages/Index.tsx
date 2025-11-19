import { LandingHeader } from "@/components/LandingHeader";
import { HeroTextSection } from "@/components/landing/HeroTextSection";
import { HowItWorksSection } from "@/components/landing/HowItWorksSection";
import { FeaturesSection } from "@/components/landing/FeaturesSection";
import { PricingSection } from "@/components/landing/PricingSection";
import { FinalCTA } from "@/components/landing/FinalCTA";
import { LandingFooter } from "@/components/landing/LandingFooter";
import { ProspectBubble } from "@/components/ProspectBubble";

export default function AlfieLanding() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <LandingHeader />

      {/* SECTION 1 : Hero avec gradient (fallback temporaire) */}
      <section className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-alfie-mint via-alfie-lilac to-alfie-pink">
        <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/40" />
        <div className="relative z-10 px-4 text-center">
          <h1 className="mb-6 text-5xl font-extrabold tracking-tight text-white drop-shadow-lg sm:text-6xl md:text-7xl">
            Alfie Designer
          </h1>
          <p className="mx-auto max-w-2xl text-xl text-white/90 drop-shadow-md sm:text-2xl">
            L'agent IA qui transforme tes idées en designs professionnels
          </p>
        </div>
        <div className="pointer-events-none absolute bottom-10 left-1/2 flex -translate-x-1/2 flex-col items-center gap-2 text-white/90">
          <span className="text-xs drop-shadow md:text-sm">Fais défiler pour découvrir</span>
          <div className="flex h-9 w-9 items-center justify-center rounded-full border border-white/70 text-base animate-bounce drop-shadow">
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

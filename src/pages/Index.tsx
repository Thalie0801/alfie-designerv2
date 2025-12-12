import { useEffect } from "react";
import { LandingHeader } from "@/components/LandingHeader";
import { HeroVideoSection } from "@/components/landing/HeroVideoSection";
import { DemoSection } from "@/components/landing/DemoSection";
import { CategoryGallerySection } from "@/components/landing/CategoryGallerySection";
import { FeatureCardsSection } from "@/components/landing/FeatureCardsSection";
import { WhyAlfieSection } from "@/components/landing/WhyAlfieSection";
import { PricingSection } from "@/components/landing/PricingSection";
import { FAQSection } from "@/components/landing/FAQSection";
import { FinalCTA } from "@/components/landing/FinalCTA";
import { LandingFooter } from "@/components/landing/LandingFooter";
import { ProspectBubble } from "@/components/ProspectBubble";
import { useAffiliate } from "@/hooks/useAffiliate";

export default function AlfieLanding() {
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
      <HeroVideoSection />
      <DemoSection />
      <CategoryGallerySection />
      <FeatureCardsSection />
      <WhyAlfieSection />
      <PricingSection />
      <FAQSection />
      <FinalCTA />
      <LandingFooter />
      <ProspectBubble />
    </div>
  );
}

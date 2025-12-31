import { useEffect } from "react";
import { motion } from "framer-motion";
import { LandingHeader } from "@/components/LandingHeader";
import { HeroVideoSection } from "@/components/landing/HeroVideoSection";
import { WorkflowSection } from "@/components/landing/WorkflowSection";
import { DemoSection } from "@/components/landing/DemoSection";
import { StudiosSection } from "@/components/landing/StudiosSection";
import { CategoryGallerySection } from "@/components/landing/CategoryGallerySection";
import { FeatureCardsSection } from "@/components/landing/FeatureCardsSection";
import { TestimonialsSection } from "@/components/landing/TestimonialsSection";
import { WhyAlfieSection } from "@/components/landing/WhyAlfieSection";
import { PricingSection } from "@/components/landing/PricingSection";
import { FAQSection } from "@/components/landing/FAQSection";
import { CommunitySection } from "@/components/landing/CommunitySection";
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
      
      {/* Impactful transition phrase */}
      <motion.section 
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-50px" }}
        transition={{ duration: 0.6 }}
        className="bg-white py-16 text-center"
      >
        <p className="text-2xl sm:text-3xl md:text-4xl font-bold text-slate-800">
          De l'idée au visuel, en{" "}
          <span className="bg-gradient-to-r from-alfie-mint to-alfie-lilac bg-clip-text text-transparent">
            30 secondes
          </span>{" "}
          ✨
        </p>
      </motion.section>
      
      <WorkflowSection />
      <DemoSection />
      <StudiosSection />
      <CategoryGallerySection />
      <FeatureCardsSection />
      <TestimonialsSection />
      <WhyAlfieSection />
      <PricingSection />
      <FAQSection />
      <CommunitySection />
      <FinalCTA />
      <LandingFooter />
      <ProspectBubble />
    </div>
  );
}

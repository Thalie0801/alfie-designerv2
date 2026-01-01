import { useState } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { PriceCard, type BillingPlan } from "@/components/landing/PriceCard";
import { trackEvent } from "@/utils/trackEvent";

const plans = [
  {
    title: "Starter",
    monthlyPrice: 39,
    features: [
      "≈ 150 Woofs créatifs / mois",
      "Exemple : jusqu'à 120 visuels ou 80 visuels + 3 vidéos courtes",
      "1 marque avec brand kit complet + Subject Packs illimités",
      "Génération d'images, carrousels et vidéos animées",
      "Export ZIP des créations prêtes à télécharger",
    ],
    plan: "starter" as const,
    aiTier: "standard" as const,
  },
  {
    title: "Pro",
    monthlyPrice: 99,
    features: [
      "≈ 450 Woofs créatifs / mois",
      "Exemple : jusqu'à 350 visuels ou 250 visuels + 10 vidéos courtes",
      "Brand kit enrichi + Subject Packs avec IA Premium",
      "Flows complets images + carrousels + vidéos",
      "Export ZIP optimisé pour réutiliser vos contenus",
      "Support prioritaire",
    ],
    plan: "pro" as const,
    popular: true,
    aiTier: "premium" as const,
  },
  {
    title: "Studio",
    monthlyPrice: 199,
    features: [
      "≈ 1000 Woofs créatifs / mois",
      "Exemple : jusqu'à 800 visuels ou 600 visuels + 20 vidéos courtes + 4 vidéos premium",
      "Brand kit complet + Subject Packs prioritaires",
      "Export Canva + packs ZIP pour livrer vite à vos clients",
      "Bibliothèque longue durée + priorité de génération",
      "Support dédié",
    ],
    plan: "studio" as const,
    aiTier: "premium" as const,
  },
];

const calculateOriginalAnnualPrice = (monthlyPrice: number) => Math.round(monthlyPrice * 12);

const calculatePrice = (monthlyPrice: number, isAnnual: boolean) => {
  if (isAnnual) {
    return `${Math.round(monthlyPrice * 12 * 0.8)}€`;
  }
  return `${monthlyPrice}€`;
};

const getPriceLabel = (isAnnual: boolean) => (isAnnual ? " / an" : " / mois");

export function PricingSection() {
  const [isAnnual, setIsAnnual] = useState(false);
  
  const handleSelectPlan = (plan: BillingPlan) => {
    trackEvent("pricing_plan_clicked", { plan });
    // Rediriger vers /auth avec le plan en paramètre
    window.location.href = `/auth?plan=${plan}`;
  };

  return (
    <motion.section 
      id="pricing" 
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true, margin: "-100px" }}
      transition={{ duration: 0.6 }}
      className="bg-gradient-to-b from-slate-50 to-white px-4 py-8 sm:py-12 md:py-16 lg:py-24 sm:px-6 lg:px-8"
    >
      <div className="mx-auto max-w-6xl">
        {/* "Pas sûr" banner */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="mb-8 text-center"
        >
          <div className="inline-flex items-center gap-2 bg-alfie-mint/20 rounded-full px-4 py-2 text-sm text-slate-700">
            <span>Pas sûr ?</span>
            <Link to="/start" className="font-medium underline underline-offset-2 hover:text-slate-900">
              Commence par le Brand Kit + pack gratuit (sans carte)
            </Link>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="mb-8 md:mb-16 text-center"
        >
          <Badge className="mb-3 md:mb-4 border border-alfie-mint/40 bg-alfie-mintSoft text-slate-700 text-xs md:text-sm" variant="secondary">
            Tarifs
          </Badge>
          <h2 className="mb-3 md:mb-4 text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold leading-tight text-slate-900">Choisis ton plan</h2>
          <p className="mx-auto mb-6 md:mb-8 max-w-2xl text-base sm:text-lg md:text-xl text-muted-foreground text-center px-4">
            Tous les plans incluent l'intégration Canva et le support
          </p>

          <div className="inline-flex items-center gap-2 md:gap-3 rounded-full border border-border/50 bg-card/50 p-1 backdrop-blur-md text-sm md:text-base">
            <button
              onClick={() => setIsAnnual(false)}
              className={`rounded-full px-4 md:px-6 py-2 transition-all min-h-[40px] ${
                !isAnnual ? "bg-alfie-mint text-slate-900 shadow-md" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Mensuel
            </button>
            <button
              onClick={() => setIsAnnual(true)}
              className={`rounded-full px-4 md:px-6 py-2 transition-all min-h-[40px] ${
                isAnnual ? "bg-alfie-mint text-slate-900 shadow-md" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Annuel
              <span className="ml-2 text-xs">-20%</span>
            </button>
          </div>
        </motion.div>

        {/* Horizontal scroll on mobile, grid on desktop */}
        <div className="mx-auto max-w-6xl">
          <div className="flex md:grid md:grid-cols-3 gap-4 md:gap-8 overflow-x-auto snap-x snap-mandatory pb-4 md:pb-0 -mx-4 px-4 md:mx-0 md:px-0" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
            {plans.map((plan, idx) => (
              <motion.div
                key={plan.title}
                initial={{ opacity: 0, y: 40, scale: 0.95 }}
                whileInView={{ opacity: 1, y: 0, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: idx * 0.1 }}
                className="flex-shrink-0 w-[85vw] sm:w-[70vw] md:w-auto snap-center"
              >
                <PriceCard
                  title={plan.title}
                  monthlyPrice={plan.monthlyPrice}
                  isAnnual={isAnnual}
                  calculatePrice={(price) => calculatePrice(price, isAnnual)}
                  calculateOriginalAnnualPrice={calculateOriginalAnnualPrice}
                  getPriceLabel={() => getPriceLabel(isAnnual)}
                  features={plan.features}
                  plan={plan.plan}
                  popular={plan.popular}
                  aiTier={plan.aiTier}
                  onSelectPlan={handleSelectPlan}
                />
              </motion.div>
            ))}
          </div>
          {/* Scroll indicator for mobile */}
          <div className="flex justify-center gap-1.5 mt-4 md:hidden">
            {plans.map((_, idx) => (
              <div key={idx} className="w-2 h-2 rounded-full bg-slate-300" />
            ))}
          </div>
        </div>
        <motion.p 
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="text-center text-xs sm:text-sm text-muted-foreground mt-4 sm:mt-6 px-4"
        >
          Crée ton compte Alfie, puis choisis ton plan et finalise le paiement dans ton espace sécurisé.
        </motion.p>
      </div>
    </motion.section>
  );
}

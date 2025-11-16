import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { PriceCard } from "@/components/landing/PriceCard";
import { useStripeCheckout } from "@/hooks/useStripeCheckout";

const plans = [
  {
    title: "Starter",
    monthlyPrice: 39,
    features: [
      "20 visuels / mois",
      "5 reels / mois",
      "1 marque",
      "Stockage 30 jours",
      "Exports illimités",
    ],
    plan: "starter" as const,
  },
  {
    title: "Pro",
    monthlyPrice: 99,
    features: [
      "60 visuels / mois",
      "20 reels / mois",
      "3 marques",
      "Stockage 90 jours",
      "Analytics avancés",
      "Support prioritaire",
    ],
    plan: "pro" as const,
    popular: true,
  },
  {
    title: "Studio",
    monthlyPrice: 199,
    features: [
      "150 visuels / mois",
      "50 reels / mois",
      "10 marques",
      "Stockage illimité",
      "API access",
      "Support dédié",
    ],
    plan: "studio" as const,
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
  const { createCheckout, loading: checkoutLoading } = useStripeCheckout();

  return (
    <section id="pricing" className="bg-muted/30 px-4 py-24 sm:px-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-16 text-center">
          <Badge className="mb-4 border border-alfie-mint/40 bg-alfie-mintSoft text-slate-700" variant="secondary">
            Tarifs
          </Badge>
          <h2 className="mb-4 text-4xl font-bold sm:text-5xl">Choisis ton plan</h2>
          <p className="mx-auto mb-8 max-w-2xl text-xl text-muted-foreground">
            Tous les plans incluent l'intégration Canva et le support
          </p>

          <div className="inline-flex items-center gap-3 rounded-full border border-border/50 bg-card/50 p-1 backdrop-blur-md">
            <button
              onClick={() => setIsAnnual(false)}
              className={`rounded-full px-6 py-2 transition-all ${
                !isAnnual ? "bg-alfie-mint text-slate-900 shadow-md" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Mensuel
            </button>
            <button
              onClick={() => setIsAnnual(true)}
              className={`rounded-full px-6 py-2 transition-all ${
                isAnnual ? "bg-alfie-mint text-slate-900 shadow-md" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Annuel
              <span className="ml-2 text-xs">-20%</span>
            </button>
          </div>
        </div>

        <div className="mx-auto grid max-w-6xl gap-8 md:grid-cols-3">
          {plans.map((plan) => (
            <PriceCard
              key={plan.title}
              title={plan.title}
              monthlyPrice={plan.monthlyPrice}
              isAnnual={isAnnual}
              calculatePrice={(price) => calculatePrice(price, isAnnual)}
              calculateOriginalAnnualPrice={calculateOriginalAnnualPrice}
              getPriceLabel={() => getPriceLabel(isAnnual)}
              features={plan.features}
              plan={plan.plan}
              popular={plan.popular}
              createCheckout={createCheckout}
              checkoutLoading={checkoutLoading}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

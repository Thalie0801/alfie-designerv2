import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { PriceCard, type BillingPlan } from "@/components/landing/PriceCard";
import { useStripeCheckout } from "@/hooks/useStripeCheckout";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

const plans = [
  {
    title: "Starter",
    monthlyPrice: 39,
    features: [
      "≈ 150 Woofs créatifs / mois",
      "Exemple : jusqu'à 120 visuels ou 80 visuels + 3 vidéos courtes",
      "1 marque avec votre brand kit (couleurs, polices, logos, mood)",
      "Génération d'images, carrousels et vidéos animées",
      "Export ZIP des créations prêtes à télécharger",
    ],
    plan: "starter" as const,
  },
  {
    title: "Pro",
    monthlyPrice: 99,
    features: [
      "≈ 450 Woofs créatifs / mois",
      "Exemple : jusqu'à 350 visuels ou 250 visuels + 10 vidéos courtes",
      "1 marque avec votre brand kit enrichi (palettes, ton de voix, assets récurrents)",
      "Flows complets images + carrousels + vidéos",
      "Export ZIP optimisé pour réutiliser vos contenus",
      "Support prioritaire",
    ],
    plan: "pro" as const,
    popular: true,
  },
  {
    title: "Studio",
    monthlyPrice: 199,
    features: [
      "≈ 1000 Woofs créatifs / mois",
      "Exemple : jusqu'à 800 visuels ou 600 visuels + 20 vidéos courtes + 4 vidéos premium",
      "1 marque avec votre brand kit complet (templates, presets, visuels piliers…)",
      "Export Canva + packs ZIP pour livrer vite à vos clients",
      "Bibliothèque longue durée + priorité de génération",
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
  const [guestEmail, setGuestEmail] = useState("");
  const { createCheckout, loading: checkoutLoading } = useStripeCheckout();
  const { user } = useAuth();
  
  const handleCheckout = async (plan: BillingPlan) => {
    if (!user && !guestEmail) {
      toast.error("Veuillez entrer votre email pour continuer");
      return;
    }
    await createCheckout(plan, isAnnual ? "annual" : "monthly", undefined, guestEmail || undefined);
  };

  return (
    <section id="pricing" className="bg-muted/30 px-4 py-8 sm:py-12 md:py-16 lg:py-24 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 md:mb-16 text-center">
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
        </div>

        <div className="mx-auto grid max-w-6xl gap-6 md:gap-8 grid-cols-1 md:grid-cols-3">
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
              onCheckout={handleCheckout}
              checkoutLoading={checkoutLoading}
              isAuthenticated={!!user}
              guestEmail={guestEmail}
              onEmailChange={setGuestEmail}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
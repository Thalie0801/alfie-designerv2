import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LandingHeader } from "@/components/LandingHeader";
import { HeroTextSection } from "@/components/landing/HeroTextSection";
import { PriceCard } from "@/components/landing/PriceCard";
import { Sparkles, Palette, Film, BarChart3, Layers, Share2, Zap, Globe, Shield } from "lucide-react";
import {
  Check,
  Sparkles,
  Palette,
  Film,
  BarChart3,
  Layers,
  Share2,
  ArrowRight,
  Zap,
  Globe,
  Shield,
} from "lucide-react";
import { useStripeCheckout } from "@/hooks/useStripeCheckout";

const alfieHeroVideo = "/videos/hero-background.mp4";

export default function AlfieLanding() {
  const [isAnnual, setIsAnnual] = useState(false);
  const { createCheckout, loading: checkoutLoading } = useStripeCheckout();

  const calculatePrice = (monthlyPrice: number) => {
    if (isAnnual) {
      const annualPrice = Math.round(monthlyPrice * 12 * 0.8);
      return `${annualPrice}€`;
    }
    return `${monthlyPrice}€`;
  };

  const calculateOriginalAnnualPrice = (monthlyPrice: number) => {
    return Math.round(monthlyPrice * 12);
  };

  const getPriceLabel = () => (isAnnual ? " / an" : " / mois");

  return (
    <div className="min-h-screen bg-background text-foreground">
      <LandingHeader />

      {/* SECTION 1 : vidéo immersive */}
      <section className="relative h-screen overflow-hidden">
        <video
          src={alfieHeroVideo}
          autoPlay
          loop
          muted
          playsInline
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-black/35" />
        <div className="pointer-events-none absolute bottom-10 left-1/2 flex -translate-x-1/2 flex-col items-center gap-2 text-white/80">
          <span className="text-xs md:text-sm">Fais défiler pour découvrir Alfie</span>
          <div className="flex h-9 w-9 items-center justify-center rounded-full border border-white/60 text-base animate-bounce">
            ↓

      {/* SECTION 1 : vidéo immersive */}
      <section className="relative h-screen overflow-hidden">
        <video
          src={alfieHeroVideo}
          autoPlay
          loop
          muted
          playsInline
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-black/35" />
        <div className="pointer-events-none absolute bottom-10 left-1/2 flex -translate-x-1/2 flex-col items-center gap-2 text-white/80">
          <span className="text-xs md:text-sm">Fais défiler pour découvrir Alfie</span>
          <div className="flex h-9 w-9 items-center justify-center rounded-full border border-white/60 text-base animate-bounce">
            ↓

      {/* SECTION 1 : vidéo immersive */}
      <section className="relative h-screen overflow-hidden">
        <video
          src={alfieHeroVideo}
          autoPlay
          loop
          muted
          playsInline
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-black/35" />
        <div className="pointer-events-none absolute bottom-10 left-1/2 flex -translate-x-1/2 flex-col items-center gap-2 text-white/80">
          <span className="text-xs md:text-sm">Fais défiler pour découvrir Alfie</span>
          <div className="flex h-9 w-9 items-center justify-center rounded-full border border-white/60 text-base animate-bounce">
            ↓
      {/* Navbar */}
      <header className="fixed top-0 left-0 right-0 z-50 backdrop-blur-xl bg-background/80 border-b border-border/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-primary via-secondary to-accent flex items-center justify-center shadow-lg">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <span className="font-bold text-xl">Alfie Designer</span>
          </div>
          <Button 
            size="lg" 
            className="group"
            onClick={() => (window.location.href = "/dashboard")}
          >
            Ouvrir l'app
            <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
          </Button>
        </div>
      </header>

      {/* Hero Section 1: immersive video */}
      <section className="relative min-h-screen w-full overflow-hidden">
        <video
          src={alfieHeroVideo}
          autoPlay
          loop
          muted
          playsInline
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-background/90 to-transparent" />
      </section>

      {/* Hero Section 2: text + CTA */}
      <section className="bg-gradient-to-b from-background to-alfie-primary/10 py-16 sm:py-24">
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-8 px-4 text-center">
          <Badge
            variant="secondary"
            className="bg-alfie-primary/10 text-alfie-primary border border-alfie-primary/30"
          >
            Agent IA de Création Visuelle
          </Badge>

          <div className="space-y-4">
            <h1 className="text-3xl sm:text-5xl md:text-6xl font-bold tracking-tight text-slate-900">
              Crée des designs{" "}
              <span className="bg-gradient-to-r from-alfie-primary via-alfie-aqua to-alfie-pink bg-clip-text text-transparent">
                professionnels
              </span>{" "}
              en quelques secondes
            </h1>
            <p className="text-base sm:text-lg text-slate-600 max-w-2xl mx-auto">
              Alfie génère tes visuels Instagram, carrousels et reels directement dans Canva.
              Pas de design, juste tes idées.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-4">
            <Button
              className="h-11 rounded-full px-6 bg-alfie-primary text-slate-900 hover:bg-alfie-aqua"
              onClick={() => document.getElementById("pricing")?.scrollIntoView({ behavior: "smooth" })}
            >
              Commencer maintenant ✨
            </Button>
            <Button
              variant="outline"
              className="h-11 rounded-full px-6 border-slate-200 bg-white/80 hover:bg-slate-50"
              onClick={() => (window.location.href = "/demo")}
            >
              Voir la démo →
            </Button>
          </div>

          <div className="flex flex-wrap gap-3 justify-center mt-10">
            {[
              { icon: Zap, label: "IA ultra-rapide" },
              { icon: Palette, label: "Design personnalisé" },
              { icon: Globe, label: "Intégration Canva" },
            ].map((feature, idx) => (
              <div
                key={idx}
                className="flex items-center gap-2 px-4 py-2 rounded-full border border-border/30 bg-white/80 text-sm"
              >
                <feature.icon className="h-4 w-4 text-alfie-primary" />
                <span>{feature.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <HeroTextSection />

      {/* How it Works */}
      <section className="py-24 px-4 sm:px-6 bg-muted/30">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <Badge className="mb-4 border border-alfie-mint/40 bg-alfie-mintSoft text-slate-700" variant="secondary">
              Simple et rapide
            </Badge>
            <h2 className="text-4xl sm:text-5xl font-bold mb-4">
              Comment ça marche ?
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Trois étapes pour transformer tes idées en designs professionnels
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                step: "01",
                icon: Sparkles,
                title: "Décris ton idée",
                description: "Explique simplement ce que tu veux créer à Alfie",
              },
              {
                step: "02",
                icon: Zap,
                title: "L'IA génère",
                description: "Alfie crée ton design en respectant ton identité de marque",
              },
              {
                step: "03",
                icon: Share2,
                title: "Récupère dans Canva",
                description: "Ton design arrive directement dans ton espace Canva",
              },
            ].map((item, idx) => (
              <Card key={idx} className="border-border/50 bg-card/50 backdrop-blur-sm hover:shadow-xl transition-all">
                <CardHeader>
                  <div className="flex items-center gap-4 mb-4">
                    <div className="text-5xl font-bold text-muted-foreground/20">
                      {item.step}
                    </div>
                    <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-alfie-mint via-alfie-lilac to-alfie-pink flex items-center justify-center shadow-lg">
                      <item.icon className="h-6 w-6 text-white" />
                    </div>
                  </div>
                  <CardTitle className="text-2xl">{item.title}</CardTitle>
                  <CardDescription className="text-base">
                    {item.description}
                  </CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-24 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <Badge className="mb-4 border border-alfie-mint/40 bg-alfie-mintSoft text-slate-700" variant="secondary">
              Fonctionnalités
            </Badge>
            <h2 className="text-4xl sm:text-5xl font-bold mb-4">
              Tout ce dont tu as besoin
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Des outils puissants pour créer du contenu qui performe
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                icon: Palette,
                title: "Brand Kit intelligent",
                description: "Alfie apprend ton identité visuelle et l'applique automatiquement",
              },
              {
                icon: Film,
                title: "Reels & Vidéos",
                description: "Crée des vidéos engageantes optimisées pour les réseaux",
              },
              {
                icon: Layers,
                title: "Carrousels Instagram",
                description: "Designs cohérents sur plusieurs slides en un clic",
              },
              {
                icon: BarChart3,
                title: "Analytics intégrés",
                description: "Suis les performances de tes créations",
              },
              {
                icon: Shield,
                title: "Stockage sécurisé",
                description: "Tes designs sauvegardés et accessibles 24/7",
              },
              {
                icon: Share2,
                title: "Exports multiples",
                description: "Télécharge en ZIP ou pousse direct dans Canva",
              },
            ].map((feature, idx) => (
              <Card key={idx} className="border-border/50 bg-card/50 backdrop-blur-sm hover:border-alfie-mint/60 hover:shadow-lg transition-all group">
                <CardHeader>
                  <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-alfie-mint/20 via-alfie-lilac/20 to-alfie-pink/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                    <feature.icon className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle className="text-xl">{feature.title}</CardTitle>
                  <CardDescription>{feature.description}</CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-24 px-4 sm:px-6 bg-muted/30">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <Badge className="mb-4 border border-alfie-mint/40 bg-alfie-mintSoft text-slate-700" variant="secondary">
              Tarifs
            </Badge>
            <h2 className="text-4xl sm:text-5xl font-bold mb-4">
              Choisis ton plan
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
              Tous les plans incluent l'intégration Canva et le support
            </p>

            <div className="inline-flex items-center gap-3 p-1 rounded-full bg-card/50 backdrop-blur-md border border-border/50">
              <button
                onClick={() => setIsAnnual(false)}
                className={`px-6 py-2 rounded-full transition-all ${
                  !isAnnual ? "bg-alfie-mint text-slate-900 shadow-md" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Mensuel
              </button>
              <button
                onClick={() => setIsAnnual(true)}
                className={`px-6 py-2 rounded-full transition-all ${
                  isAnnual ? "bg-alfie-mint text-slate-900 shadow-md" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Annuel
                <span className="ml-2 text-xs">-20%</span>
              </button>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            <PriceCard
              title="Starter"
              monthlyPrice={39}
              isAnnual={isAnnual}
              calculatePrice={calculatePrice}
              calculateOriginalAnnualPrice={calculateOriginalAnnualPrice}
              getPriceLabel={getPriceLabel}
              features={[
                "20 visuels / mois",
                "5 reels / mois",
                "1 marque",
                "Stockage 30 jours",
                "Exports illimités",
              ]}
              plan="starter"
              createCheckout={createCheckout}
              checkoutLoading={checkoutLoading}
            />

            <PriceCard
              title="Pro"
              monthlyPrice={99}
              isAnnual={isAnnual}
              calculatePrice={calculatePrice}
              calculateOriginalAnnualPrice={calculateOriginalAnnualPrice}
              getPriceLabel={getPriceLabel}
              popular
              features={[
                "60 visuels / mois",
                "20 reels / mois",
                "3 marques",
                "Stockage 90 jours",
                "Analytics avancés",
                "Support prioritaire",
              ]}
              plan="pro"
              createCheckout={createCheckout}
              checkoutLoading={checkoutLoading}
            />

            <PriceCard
              title="Studio"
              monthlyPrice={199}
              isAnnual={isAnnual}
              calculatePrice={calculatePrice}
              calculateOriginalAnnualPrice={calculateOriginalAnnualPrice}
              getPriceLabel={getPriceLabel}
              features={[
                "150 visuels / mois",
                "50 reels / mois",
                "10 marques",
                "Stockage illimité",
                "API access",
                "Support dédié",
              ]}
              plan="studio"
              createCheckout={createCheckout}
              checkoutLoading={checkoutLoading}
            />
          </div>
        </div>
      </section>

      {/* CTA Final */}
      <section className="py-24 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="p-12 rounded-3xl bg-gradient-to-br from-alfie-mint/15 via-alfie-lilac/15 to-alfie-pink/20 border border-border/50 backdrop-blur-sm">
            <h2 className="text-4xl sm:text-5xl font-bold mb-6">
              Prêt à créer du contenu qui cartonne ?
            </h2>
            <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
              Rejoins des centaines de créateurs qui utilisent Alfie pour gagner du temps
            </p>
            <Button 
              size="lg" 
              className="h-14 px-8 text-lg shadow-xl hover:shadow-2xl hover:scale-105 transition-all"
              onClick={() => document.getElementById("pricing")?.scrollIntoView({ behavior: "smooth" })}
            >
              Commencer gratuitement
              <Sparkles className="ml-2 h-5 w-5" />
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/50 bg-muted/30 py-12 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-alfie-mint via-alfie-lilac to-alfie-pink flex items-center justify-center">
                  <Sparkles className="h-4 w-4 text-white" />
                </div>
                <span className="font-bold">Alfie Designer</span>
              </div>
              <p className="text-sm text-muted-foreground">
                L'agent IA qui transforme tes idées en designs professionnels
              </p>
            </div>

            <div>
              <h4 className="font-semibold mb-4">Produit</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="/demo" className="hover:text-foreground transition-colors">Démo</a></li>
                <li><a href="#pricing" className="hover:text-foreground transition-colors">Tarifs</a></li>
                <li><a href="/dashboard" className="hover:text-foreground transition-colors">Dashboard</a></li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold mb-4">Ressources</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="/faq" className="hover:text-foreground transition-colors">FAQ</a></li>
                <li><a href="/contact" className="hover:text-foreground transition-colors">Support</a></li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold mb-4">Légal</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="/legal" className="hover:text-foreground transition-colors">Mentions légales</a></li>
                <li><a href="/privacy" className="hover:text-foreground transition-colors">Confidentialité</a></li>
              </ul>
            </div>
          </div>

          <div className="pt-8 border-t border-border/50 text-center text-sm text-muted-foreground">
            <p>© 2024 Alfie Designer. Tous droits réservés.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

function HeroTextSection() {
  const featurePills = [
    { icon: Zap, label: "IA ultra-rapide" },
    { icon: Palette, label: "Design personnalisé" },
    { icon: Globe, label: "Intégration Canva" },
  ];

  return (
    <section className="relative bg-gradient-to-b from-white to-slate-50">
      <div className="mx-auto flex max-w-5xl flex-col items-center gap-8 px-4 pt-20 pb-24 text-center">
        <Badge
          variant="secondary"
          className="border border-alfie-mint/40 bg-alfie-mintSoft text-slate-700"
        >
          Agent IA de Création Visuelle
        </Badge>

        <div className="space-y-4">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-5xl md:text-6xl">
            Crée des designs{" "}
            <span className="bg-gradient-to-r from-alfie-mint via-alfie-lilac to-alfie-pink bg-clip-text text-transparent">
              professionnels
            </span>{" "}
            en quelques secondes
          </h1>
          <p className="mx-auto max-w-2xl text-base text-slate-600 sm:text-lg">
            Alfie génère tes visuels Instagram, carrousels et reels directement dans Canva.
            Pas de design, juste tes idées.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-4">
          <Button
            className="h-11 rounded-full bg-alfie-mint px-6 text-slate-900 hover:bg-alfie-pink"
            onClick={() => document.getElementById("pricing")?.scrollIntoView({ behavior: "smooth" })}
          >
            Commencer maintenant ✨
          </Button>
          <Button
            variant="outline"
            className="h-11 rounded-full border-slate-200 bg-white/80 px-6 text-slate-900 hover:bg-slate-100"
            onClick={() => (window.location.href = "/demo")}
          >
            Voir la démo →
          </Button>
        </div>

        <div className="mt-8 flex flex-wrap justify-center gap-3">
          {featurePills.map((feature) => (
            <div
              key={feature.label}
              className="flex items-center gap-2 rounded-full border border-slate-200/80 bg-white px-4 py-2 text-sm text-slate-700 shadow-sm"
            >
              <feature.icon className="h-4 w-4 text-alfie-mint" />
              <span>{feature.label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

interface PriceCardProps {
  title: string;
  monthlyPrice: number;
  isAnnual: boolean;
  calculatePrice: (price: number) => string;
  calculateOriginalAnnualPrice: (price: number) => number;
  getPriceLabel: () => string;
  features: string[];
  plan: 'starter' | 'pro' | 'studio' | 'enterprise';
  popular?: boolean;
  createCheckout: (plan: 'starter' | 'pro' | 'studio' | 'enterprise', billingPeriod?: 'monthly' | 'annual', brandName?: string) => Promise<void>;
  checkoutLoading: boolean;
}

function PriceCard({
  title,
  monthlyPrice,
  isAnnual,
  calculatePrice,
  calculateOriginalAnnualPrice,
  getPriceLabel,
  features,
  plan,
  popular,
  createCheckout,
  checkoutLoading,
}: PriceCardProps) {
  return (
    <Card className={`relative border-border/50 bg-card/50 backdrop-blur-sm hover:shadow-2xl transition-all ${popular ? 'border-alfie-mint shadow-xl scale-105' : ''}`}>
      {popular && (
        <div className="absolute -top-4 left-0 right-0 flex justify-center">
          <Badge className="bg-alfie-mint text-slate-900 shadow-lg">
            Le plus populaire
          </Badge>
        </div>
      )}
      <CardHeader className="text-center pb-8 pt-8">
        <CardTitle className="text-2xl mb-2">{title}</CardTitle>
        <div className="flex items-baseline justify-center gap-1 mb-2">
          <span className="text-5xl font-bold">{calculatePrice(monthlyPrice)}</span>
          <span className="text-muted-foreground">{getPriceLabel()}</span>
        </div>
        {isAnnual && (
          <div className="text-sm text-muted-foreground line-through">
            {calculateOriginalAnnualPrice(monthlyPrice)}€ / an
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        <ul className="space-y-3">
          {features.map((feature, idx) => (
            <li key={idx} className="flex items-start gap-2">
              <Check className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
              <span className="text-sm">{feature}</span>
            </li>
          ))}
        </ul>
      </CardContent>
      <CardFooter>
        <Button
          className="w-full h-12"
          variant={popular ? "default" : "outline"}
          disabled={checkoutLoading}
          onClick={() => createCheckout(plan, isAnnual ? 'annual' : 'monthly')}
        >
          {checkoutLoading ? "Chargement..." : "Commencer"}
        </Button>
      </CardFooter>
    </Card>
  );
}

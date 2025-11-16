import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Check,
  Sparkles,
  Palette,
  Film,
  BarChart3,
  Layers,
  Share2,
  ChevronRight,
  ArrowRight,
  Zap,
  Globe,
  Shield,
} from "lucide-react";
import { useStripeCheckout } from "@/hooks/useStripeCheckout";

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

      {/* Hero Section with Video Background */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
        {/* Video Background */}
        <div className="absolute inset-0 z-0">
          <video
            autoPlay
            loop
            muted
            playsInline
            className="absolute inset-0 w-full h-full object-cover"
          >
            <source src="/videos/hero-background.mp4" type="video/mp4" />
          </video>
          <div className="absolute inset-0 bg-gradient-to-b from-background/95 via-background/80 to-background/95" />
          <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-accent/5" />
        </div>

        {/* Hero Content */}
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 py-32 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-card/50 backdrop-blur-md border border-border/50 mb-8 animate-fade-in">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">Agent IA de Création Visuelle</span>
          </div>

          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold leading-tight tracking-tight mb-6 animate-fade-in">
            Crée des designs{" "}
            <span className="bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent">
              professionnels
            </span>
            <br />
            en quelques secondes
          </h1>

          <p className="text-xl sm:text-2xl text-muted-foreground max-w-3xl mx-auto mb-12 animate-fade-in leading-relaxed">
            Alfie génère tes visuels Instagram, carrousels et reels directement dans Canva.
            Pas de design, juste tes idées.
          </p>

          <div className="flex flex-wrap gap-4 justify-center items-center animate-fade-in">
            <Button 
              size="lg" 
              className="h-14 px-8 text-lg shadow-xl hover:shadow-2xl hover:scale-105 transition-all"
              onClick={() => document.getElementById("pricing")?.scrollIntoView({ behavior: "smooth" })}
            >
              Commencer maintenant
              <Sparkles className="ml-2 h-5 w-5" />
            </Button>
            <Button 
              size="lg" 
              variant="outline"
              className="h-14 px-8 text-lg backdrop-blur-md bg-card/50 hover:bg-card/80 transition-all"
              onClick={() => (window.location.href = "/demo")}
            >
              Voir la démo
              <ChevronRight className="ml-2 h-5 w-5" />
            </Button>
          </div>

          {/* Feature Pills */}
          <div className="flex flex-wrap gap-3 justify-center mt-16">
            {[
              { icon: Zap, label: "IA ultra-rapide" },
              { icon: Palette, label: "Design personnalisé" },
              { icon: Globe, label: "Intégration Canva" },
            ].map((feature, idx) => (
              <div 
                key={idx}
                className="flex items-center gap-2 px-4 py-2 rounded-full bg-card/30 backdrop-blur-md border border-border/30 text-sm"
              >
                <feature.icon className="h-4 w-4 text-primary" />
                <span>{feature.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it Works */}
      <section className="py-24 px-4 sm:px-6 bg-muted/30">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <Badge className="mb-4" variant="secondary">
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
                    <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-primary via-secondary to-accent flex items-center justify-center shadow-lg">
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
            <Badge className="mb-4" variant="secondary">
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
              <Card key={idx} className="border-border/50 bg-card/50 backdrop-blur-sm hover:border-primary/50 hover:shadow-lg transition-all group">
                <CardHeader>
                  <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-primary/10 to-accent/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
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
            <Badge className="mb-4" variant="secondary">
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
                  !isAnnual ? "bg-primary text-white shadow-md" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Mensuel
              </button>
              <button
                onClick={() => setIsAnnual(true)}
                className={`px-6 py-2 rounded-full transition-all ${
                  isAnnual ? "bg-primary text-white shadow-md" : "text-muted-foreground hover:text-foreground"
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
          <div className="p-12 rounded-3xl bg-gradient-to-br from-primary/10 via-secondary/10 to-accent/10 border border-border/50 backdrop-blur-sm">
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
                <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-primary via-secondary to-accent flex items-center justify-center">
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
    <Card className={`relative border-border/50 bg-card/50 backdrop-blur-sm hover:shadow-2xl transition-all ${popular ? 'border-primary shadow-xl scale-105' : ''}`}>
      {popular && (
        <div className="absolute -top-4 left-0 right-0 flex justify-center">
          <Badge className="bg-primary text-white shadow-lg">
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

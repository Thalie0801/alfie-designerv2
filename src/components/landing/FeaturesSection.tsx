import { Palette, Film, Layers, BarChart3, Shield, Share2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const features = [
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
] as const;

export function FeaturesSection() {
  return (
    <section className="px-4 py-12 sm:px-6 sm:py-16 lg:px-8 lg:py-24">
      <div className="mx-auto max-w-6xl">
        <div className="mb-16 text-center">
          <Badge className="mb-4 border border-alfie-mint/40 bg-alfie-mintSoft text-slate-700" variant="secondary">
            Fonctionnalités
          </Badge>
          <h2 className="mb-4 text-3xl font-bold leading-tight text-slate-900 sm:text-4xl md:text-5xl">
            Tout ce dont tu as besoin
          </h2>
          <p className="mx-auto max-w-2xl text-xl text-muted-foreground text-center">
            Des outils puissants pour créer du contenu qui performe
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <Card
              key={feature.title}
              className="group border-border/50 bg-card/50 backdrop-blur-sm transition-all hover:border-alfie-mint/60 hover:shadow-lg"
            >
              <CardHeader>
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-alfie-mint/20 via-alfie-lilac/20 to-alfie-pink/20 transition-transform group-hover:scale-110">
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
  );
}

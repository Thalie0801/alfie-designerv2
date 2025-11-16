import { Sparkles, Zap, Share2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const steps = [
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
] as const;

export function HowItWorksSection() {
  return (
    <section className="bg-muted/30 px-4 py-24 sm:px-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-16 text-center">
          <Badge className="mb-4 border border-alfie-mint/40 bg-alfie-mintSoft text-slate-700" variant="secondary">
            Simple et rapide
          </Badge>
          <h2 className="mb-4 text-4xl font-bold sm:text-5xl">Comment ça marche ?</h2>
          <p className="mx-auto max-w-2xl text-xl text-muted-foreground">
            Trois étapes pour transformer tes idées en designs professionnels
          </p>
        </div>

        <div className="grid gap-8 md:grid-cols-3">
          {steps.map((item) => (
            <Card key={item.step} className="border-border/50 bg-card/50 backdrop-blur-sm transition-all hover:shadow-xl">
              <CardHeader>
                <div className="mb-4 flex items-center gap-4">
                  <div className="text-5xl font-bold text-muted-foreground/20">{item.step}</div>
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-alfie-mint via-alfie-lilac to-alfie-pink shadow-lg">
                    <item.icon className="h-6 w-6 text-white" />
                  </div>
                </div>
                <CardTitle className="text-2xl">{item.title}</CardTitle>
                <CardDescription className="text-base">{item.description}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

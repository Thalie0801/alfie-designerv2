import { Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";

export function FinalCTA() {
  const handleScrollToPricing = () => {
    if (typeof document === "undefined") return;
    document.getElementById("pricing")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <section className="px-4 py-24 sm:px-6">
      <div className="mx-auto max-w-4xl text-center">
        <div className="rounded-3xl border border-border/50 bg-gradient-to-br from-alfie-mint/15 via-alfie-lilac/15 to-alfie-pink/20 p-12 backdrop-blur-sm">
          <h2 className="mb-6 text-4xl font-bold sm:text-5xl">Prêt à créer du contenu qui cartonne ?</h2>
          <p className="mx-auto mb-8 max-w-2xl text-xl text-muted-foreground">
            Rejoins des centaines de créateurs qui utilisent Alfie pour gagner du temps
          </p>
          <Button
            size="lg"
            className="h-14 px-8 text-lg shadow-xl transition-all hover:scale-105 hover:shadow-2xl"
            onClick={handleScrollToPricing}
          >
            Commencer gratuitement
            <Sparkles className="ml-2 h-5 w-5" />
          </Button>
        </div>
      </div>
    </section>
  );
}

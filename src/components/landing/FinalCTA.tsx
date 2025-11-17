import { Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";

export function FinalCTA() {
  const handleScrollToPricing = () => {
    if (typeof document === "undefined") return;
    document.getElementById("pricing")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <section className="px-4 py-12 sm:px-6 sm:py-16 lg:px-8 lg:py-24">
      <div className="mx-auto max-w-4xl text-center">
        <div className="rounded-3xl border border-border/50 bg-gradient-to-br from-alfie-mint/15 via-alfie-lilac/15 to-alfie-pink/20 p-8 backdrop-blur-sm sm:p-12">
          <h2 className="text-2xl font-bold leading-tight text-slate-900 sm:text-3xl md:text-4xl">
            Prêt à créer du contenu qui cartonne&nbsp;?
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-base text-muted-foreground sm:text-lg">
            Rejoins des centaines de créateurs qui utilisent Alfie pour gagner du temps
          </p>
          <Button
            size="lg"
            className="mt-6 w-full rounded-full bg-[#54d7c5] px-8 py-3 text-sm font-semibold text-slate-900 shadow-md hover:bg-[#46c2b1] sm:w-auto"
            onClick={handleScrollToPricing}
          >
            Commencer maintenant ✨
            <Sparkles className="ml-2 h-5 w-5" />
          </Button>
        </div>
      </div>
    </section>
  );
}

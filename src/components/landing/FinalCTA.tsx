import { Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { trackEvent } from "@/utils/trackEvent";

export function FinalCTA() {
  const navigate = useNavigate();

  const handleCtaClick = () => {
    trackEvent("final_cta_click");
    navigate("/start");
  };

  const scrollToDemo = () => {
    trackEvent("final_demo_click");
    if (typeof document === "undefined") return;
    document.getElementById("demo")?.scrollIntoView({ behavior: "smooth" });
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
          <div className="mt-6 flex flex-col items-center gap-3">
            <Button
              size="lg"
              className="w-full rounded-full bg-alfie-mint px-8 py-3 text-sm font-semibold text-slate-900 shadow-md hover:bg-alfie-pink sm:w-auto"
              onClick={handleCtaClick}
            >
              <Sparkles className="mr-2 h-5 w-5" />
              Créer mon Brand Kit (1 min)
            </Button>
            <button
              onClick={scrollToDemo}
              className="text-sm text-slate-500 underline underline-offset-2 hover:text-slate-700 transition-colors"
            >
              Voir la démo
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

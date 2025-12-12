import { Button } from "@/components/ui/button";
import { CheckCircle2, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";

export function FreeTrialBlock() {
  const navigate = useNavigate();

  const handleCtaClick = () => {
    console.log("free_trial_cta_click");
    navigate("/quiz");
  };

  const features = [
    "Post 1:1 + Story 9:16 + Cover 4:5",
    "Style + couleurs + typo de ta marque",
    "Livré en quelques minutes",
  ];

  return (
    <section className="px-4 py-12 sm:py-16 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl">
        <div className="rounded-3xl border border-border/50 bg-gradient-to-br from-alfie-mint/15 via-alfie-lilac/15 to-alfie-pink/20 p-8 sm:p-12 text-center shadow-lg">
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-4">
            Commence gratuitement
          </h2>
          <p className="text-lg text-muted-foreground mb-8 max-w-xl mx-auto">
            Alfie te génère 3 visuels prêts à poster, adaptés à ton Brand Kit.
          </p>

          <div className="space-y-3 mb-8 text-left max-w-md mx-auto">
            {features.map((feature) => (
              <div key={feature} className="flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5 text-alfie-mint flex-shrink-0" />
                <span className="text-slate-700">{feature}</span>
              </div>
            ))}
          </div>

          <Button
            size="lg"
            className="rounded-full bg-alfie-mint px-8 py-3 text-base font-semibold text-slate-900 shadow-md hover:bg-alfie-pink"
            onClick={handleCtaClick}
          >
            <Sparkles className="mr-2 h-5 w-5" />
            Créer mon Brand Kit (1 min)
          </Button>

          <p className="mt-4 text-sm text-muted-foreground">
            Ensuite : upgrade à 19€ pour un carrousel 10 slides + CSV Canva.
          </p>
        </div>
      </div>
    </section>
  );
}

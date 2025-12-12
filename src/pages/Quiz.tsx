import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, CheckCircle2 } from "lucide-react";
import { LandingHeader } from "@/components/LandingHeader";
import { LandingFooter } from "@/components/landing/LandingFooter";

export default function Quiz() {
  const handleStartQuiz = () => {
    console.log("quiz_start_click");
    // TODO: Intégrer le questionnaire Brand Kit
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-white via-slate-50 to-white">
      <LandingHeader />
      
      <main className="px-4 py-16 sm:py-24">
        <div className="mx-auto max-w-2xl text-center">
          <Badge variant="secondary" className="mb-6 border border-alfie-mint/40 bg-alfie-mintSoft text-slate-700">
            100% Gratuit
          </Badge>
          
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-slate-900 mb-4">
            Crée ton{" "}
            <span className="bg-gradient-to-r from-[#7fdce2] via-[#c99df8] to-[#ff9fd4] bg-clip-text text-transparent">
              Brand Kit
            </span>{" "}
            (1 min)
          </h1>
          
          <p className="text-lg text-slate-600 mb-8">
            Réponds à 5 questions → Alfie génère 3 visuels gratuits adaptés à ta marque
          </p>

          <div className="rounded-2xl border border-border/50 bg-gradient-to-br from-alfie-mint/10 via-alfie-lilac/10 to-alfie-pink/15 p-8 mb-8">
            <div className="space-y-4 text-left mb-8">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5 text-alfie-mint flex-shrink-0" />
                <span className="text-slate-700">Post 1:1 + Story 9:16 + Cover 4:5</span>
              </div>
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5 text-alfie-mint flex-shrink-0" />
                <span className="text-slate-700">Style + couleurs + typo de ta marque</span>
              </div>
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5 text-alfie-mint flex-shrink-0" />
                <span className="text-slate-700">Livré en quelques minutes</span>
              </div>
            </div>

            <Button
              size="lg"
              className="w-full sm:w-auto rounded-full bg-alfie-mint px-8 py-3 text-base font-semibold text-slate-900 shadow-md hover:bg-alfie-pink"
              onClick={handleStartQuiz}
            >
              <Sparkles className="mr-2 h-5 w-5" />
              Commencer le quiz
            </Button>
          </div>

          <p className="text-sm text-muted-foreground">
            Sans carte bancaire • Tes visuels sont prêts en 5 min
          </p>
        </div>
      </main>

      <LandingFooter />
    </div>
  );
}

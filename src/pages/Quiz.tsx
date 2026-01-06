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
          
          <p className="text-base sm:text-lg text-slate-600 mb-6 sm:mb-8">
            Réponds à 5 questions → Alfie génère 3 visuels gratuits adaptés à ta marque
          </p>

          <div className="rounded-2xl border border-border/50 bg-gradient-to-br from-alfie-mint/10 via-alfie-lilac/10 to-alfie-pink/15 p-6 sm:p-8 mb-6 sm:mb-8">
            <div className="space-y-3 sm:space-y-4 text-left mb-6 sm:mb-8">
              <div className="flex items-center gap-2 sm:gap-3">
                <CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5 text-alfie-mint flex-shrink-0" />
                <span className="text-sm sm:text-base text-slate-700">Post 1:1 + Story 9:16 + Cover 4:5</span>
              </div>
              <div className="flex items-center gap-2 sm:gap-3">
                <CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5 text-alfie-mint flex-shrink-0" />
                <span className="text-sm sm:text-base text-slate-700">Style + couleurs + typo de ta marque</span>
              </div>
              <div className="flex items-center gap-2 sm:gap-3">
                <CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5 text-alfie-mint flex-shrink-0" />
                <span className="text-sm sm:text-base text-slate-700">Livré en quelques minutes</span>
              </div>
            </div>

            <Button
              size="lg"
              className="w-full sm:w-auto rounded-full bg-alfie-mint px-6 sm:px-8 py-3 text-sm sm:text-base font-semibold text-slate-900 shadow-md hover:bg-alfie-pink flex flex-col items-center gap-0.5"
              onClick={handleStartQuiz}
            >
              <span className="flex items-center">
                <Sparkles className="mr-2 h-4 w-4 sm:h-5 sm:w-5" />
                ✅ Créer mon Pack Gratuit
              </span>
              <span className="text-[10px] sm:text-xs font-normal opacity-80">(3 visuels prêts à poster)</span>
            </Button>
          </div>

          <p className="text-xs sm:text-sm text-muted-foreground">
            Brand Kit inclus (via quiz) · 1 minute · Sans carte bancaire
          </p>
        </div>
      </main>

      <LandingFooter />
    </div>
  );
}

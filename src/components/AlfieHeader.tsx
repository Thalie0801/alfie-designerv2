import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import alfieHero from "@/assets/alfie-hero.jpg";

export const AlfieHeader = () => {
  return (
    <div className="relative overflow-hidden rounded-3xl mb-12">
      <div className="absolute inset-0 gradient-hero opacity-90" />
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-background/80" />
      
      <div className="relative px-8 py-16 md:py-24">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center gap-8">
          <div className="flex-1 text-white space-y-6">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/20 backdrop-blur-sm border border-white/30 text-sm font-medium">
              <Sparkles className="w-4 h-4" />
              <span>Directeur Artistique IA</span>
            </div>
            
            <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold leading-tight">
              Bonjour, c'est Alfie ! 👋
            </h1>
            
            <p className="text-xl md:text-2xl text-white/90 max-w-2xl leading-relaxed">
              Votre assistant créatif qui génère des visuels professionnels pour vos réseaux sociaux directement dans Canva.
            </p>
            
            <div className="flex flex-wrap gap-4 pt-4">
              <Button size="lg" variant="secondary" className="shadow-strong" onClick={() => window.location.href = '/demo'}>
                Tester la démo
              </Button>
              <Button size="lg" variant="outline" className="bg-white/10 border-white/30 text-white hover:bg-white/20">
                Comment ça marche ?
              </Button>
            </div>
          </div>
          
          <div className="flex-shrink-0 w-full md:w-96 lg:w-[500px]">
            <div className="relative">
              <div className="absolute -inset-4 bg-gradient-to-r from-secondary to-accent rounded-3xl blur-2xl opacity-30 animate-pulse-soft" />
              <img 
                src={`${alfieHero}?v=2`} 
                alt="Alfie - Golden Retriever avec lunettes noires"
                className="relative rounded-2xl shadow-strong w-full h-auto"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

import { Sparkles, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import alfieHero from "@/assets/alfie-hero.jpg";

export const AlfieHeader = () => {
  return (
    <div className="relative overflow-hidden rounded-3xl mb-8 group">
      {/* Animated gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/90 via-secondary/90 to-accent/90" />
      <div className="absolute inset-0 bg-gradient-to-t from-background/20 to-transparent" />
      
      {/* Animated glow effect */}
      <div className="absolute -inset-[100%] opacity-20">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-gradient-to-r from-primary to-accent rounded-full blur-3xl animate-pulse-soft" />
      </div>
      
      <div className="relative px-6 sm:px-8 py-12 sm:py-16">
        <div className="max-w-7xl mx-auto grid md:grid-cols-2 gap-8 items-center">
          {/* Content */}
          <div className="text-white space-y-6 z-10">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/20 backdrop-blur-md border border-white/30 text-sm font-medium animate-fade-in">
              <Zap className="w-4 h-4" />
              <span>Directeur Artistique IA</span>
            </div>
            
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight animate-fade-in">
              Salut, c'est Alfie ! 👋
            </h1>
            
            <p className="text-lg sm:text-xl text-white/90 max-w-xl leading-relaxed animate-fade-in">
              Ton assistant créatif qui génère des visuels pro pour tes réseaux sociaux directement dans Canva.
            </p>
            
            <div className="flex flex-wrap gap-3 pt-4 animate-fade-in">
              <Button 
                size="lg" 
                className="bg-white/20 backdrop-blur-md border border-white/30 text-white hover:bg-white/30 hover:scale-105 transition-all shadow-xl"
                onClick={() => window.location.href = '/chat'}
              >
                <Sparkles className="w-4 h-4 mr-2" />
                Commencer à créer
              </Button>
              <Button 
                size="lg" 
                variant="ghost"
                className="text-white hover:bg-white/10 border border-white/20 backdrop-blur-sm"
                onClick={() => window.location.href = '/demo'}
              >
                Voir la démo
              </Button>
            </div>
          </div>
          
          {/* Image with enhanced animation */}
          <div className="relative md:block hidden">
            <div className="relative group-hover:scale-105 transition-transform duration-700">
              {/* Glow effect */}
              <div className="absolute -inset-8 bg-gradient-to-r from-primary via-secondary to-accent rounded-3xl blur-3xl opacity-30 group-hover:opacity-50 transition-opacity duration-700" />
              
              {/* Image container */}
              <div className="relative rounded-2xl overflow-hidden shadow-2xl border-2 border-white/20 backdrop-blur-sm">
                <img 
                  src={`${alfieHero}?v=2`} 
                  alt="Alfie - Ton assistant IA créatif"
                  className="relative w-full h-auto"
                />
                {/* Overlay gradient */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              </div>
              
              {/* Floating badge */}
              <div className="absolute -bottom-4 -right-4 bg-gradient-to-br from-accent to-secondary text-white px-6 py-3 rounded-2xl shadow-xl backdrop-blur-md border border-white/20 animate-float">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5" />
                  <span className="font-bold">Prêt à créer</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

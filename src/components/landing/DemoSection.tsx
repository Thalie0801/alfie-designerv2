import { Button } from "@/components/ui/button";
import { Play, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";

export function DemoSection() {
  const navigate = useNavigate();

  const handleCtaClick = () => {
    console.log("demo_cta_click");
    navigate("/quiz");
  };

  const exampleVisuals = [
    { title: "Post Instagram", ratio: "1:1", color: "from-alfie-mint to-alfie-lilac" },
    { title: "Story", ratio: "9:16", color: "from-alfie-lilac to-alfie-pink" },
    { title: "Carrousel", ratio: "4:5", color: "from-alfie-pink to-alfie-mint" },
  ];

  return (
    <section id="demo" className="px-4 py-16 sm:py-24 sm:px-6 lg:px-8 bg-gradient-to-b from-slate-50 to-white">
      <div className="mx-auto max-w-6xl">
        <div className="text-center mb-12">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-slate-900 mb-4">
            Une démo rapide (30 sec)
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Regarde comment Alfie transforme une idée en visuels brandés.
          </p>
        </div>

        {/* Video placeholder */}
        <div className="relative rounded-2xl overflow-hidden bg-gradient-to-br from-slate-900 to-slate-800 aspect-video mb-12 shadow-xl">
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex flex-col items-center gap-4 text-white/80">
              <div className="h-20 w-20 rounded-full bg-white/10 backdrop-blur flex items-center justify-center border border-white/20 cursor-pointer hover:bg-white/20 transition-colors">
                <Play className="h-8 w-8 ml-1" />
              </div>
              <span className="text-sm">Démo vidéo (bientôt)</span>
            </div>
          </div>
          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent pointer-events-none" />
        </div>

        {/* Mini examples */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-12">
          {exampleVisuals.map((visual) => (
            <div
              key={visual.title}
              className={`rounded-xl bg-gradient-to-br ${visual.color} p-6 aspect-square flex flex-col items-center justify-center text-center shadow-lg`}
            >
              <span className="text-white/90 font-semibold text-lg mb-2">{visual.title}</span>
              <span className="text-white/70 text-sm">{visual.ratio}</span>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="text-center">
          <Button
            size="lg"
            className="rounded-full bg-alfie-mint px-8 py-3 text-base font-semibold text-slate-900 shadow-md hover:bg-alfie-pink"
            onClick={handleCtaClick}
          >
            <Sparkles className="mr-2 h-5 w-5" />
            Créer mon Brand Kit (1 min)
          </Button>
        </div>
      </div>
    </section>
  );
}

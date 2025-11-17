import { useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Globe, Palette, Zap } from "lucide-react";

const featurePills = [
  { icon: Zap, label: "IA ultra-rapide" },
  { icon: Palette, label: "Design personnalisé" },
  { icon: Globe, label: "Intégration Canva" },
];

export function HeroTextSection() {
  const sectionRef = useRef<HTMLElement | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !sectionRef.current) {
      setIsVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.3 }
    );

    observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  const scrollToPricing = () => {
    if (typeof document === "undefined") return;
    document.getElementById("pricing")?.scrollIntoView({ behavior: "smooth" });
  };

  const goToDemo = () => {
    if (typeof window === "undefined") return;
    window.location.href = "/demo";
  };

  return (
    <section ref={sectionRef} className="relative bg-gradient-to-b from-white to-slate-50">
      <div
        className={`mx-auto flex max-w-5xl flex-col items-center gap-8 px-4 pt-20 pb-24 text-center transition-all duration-700 ease-out ${
          isVisible ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"
        }`}
      >
        <Badge variant="secondary" className="border border-alfie-mint/40 bg-alfie-mintSoft text-slate-700">
          Agent IA de Création Visuelle
        </Badge>

        <div className="space-y-4">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-5xl md:text-6xl">
            Crée des designs{" "}
            <span className="relative inline-flex items-center">
              <span className="bg-gradient-to-r from-alfie-mint via-alfie-lilac to-alfie-pink bg-clip-text text-transparent">
                {typedText || "\u00A0"}
              </span>
              <span
                className="ml-1 inline-block h-8 w-[2px] animate-pulse rounded bg-alfie-mint align-middle"
                aria-hidden="true"
              />
            <span className="bg-gradient-to-r from-alfie-mint via-alfie-lilac to-alfie-pink bg-clip-text text-transparent">
              professionnels
            </span>{" "}
            en quelques secondes
          </h1>
          <p className="mx-auto max-w-2xl text-base text-slate-600 sm:text-lg">
            Alfie génère tes visuels Instagram, carrousels et reels directement dans Canva. Pas de design, juste tes idées.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-4">
          <Button className="h-11 rounded-full bg-alfie-mint px-6 text-slate-900 hover:bg-alfie-pink" onClick={scrollToPricing}>
            Commencer maintenant ✨
          </Button>
          <Button
            variant="outline"
            className="h-11 rounded-full border-slate-200 bg-white/80 px-6 text-slate-900 hover:bg-slate-100"
            onClick={goToDemo}
          >
            Voir la démo →
          </Button>
        </div>

        <div className="mt-8 flex flex-wrap justify-center gap-3">
          {featurePills.map((feature) => (
            <div
              key={feature.label}
              className="flex items-center gap-2 rounded-full border border-slate-200/80 bg-white px-4 py-2 text-sm text-slate-700 shadow-sm"
            >
              <feature.icon className="h-4 w-4 text-alfie-mint" />
              <span>{feature.label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Globe, Palette, Zap } from "lucide-react";
import { trackEvent } from "@/utils/trackEvent";

const featurePills = [
  { icon: Zap, label: "IA ultra-rapide" },
  { icon: Palette, label: "Design personnalisé" },
  { icon: Globe, label: "Multi-formats" },
];

const heroAdjectives = ["viraux", "professionnels", "impactants"];

export function HeroTextSection() {
  const sectionRef = useRef<HTMLElement | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [phraseIndex, setPhraseIndex] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    if (typeof window === "undefined") return;

    const interval = window.setInterval(() => {
      setPhraseIndex((prev) => (prev + 1) % heroAdjectives.length);
    }, 2500);

    return () => window.clearInterval(interval);
  }, []);

  const typedText = heroAdjectives[phraseIndex];

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

  const goToStart = () => {
    trackEvent("home_cta_primary_click");
    navigate("/start");
  };

  const scrollToDemo = () => {
    trackEvent("home_demo_click");
    if (typeof document === "undefined") return;
    document.getElementById("demo")?.scrollIntoView({ behavior: "smooth" });
  };

  const scrollToPricing = () => {
    trackEvent("home_pricing_click");
    if (typeof document === "undefined") return;
    document.getElementById("pricing")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <section ref={sectionRef} className="relative bg-gradient-to-b from-white to-slate-50 px-4 sm:px-6 lg:px-8">
      <div
        className={`mx-auto flex max-w-5xl flex-col items-center gap-6 sm:gap-8 py-12 sm:py-16 md:py-20 lg:py-24 text-center transition-all duration-700 ease-out ${
          isVisible ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"
        }`}
      >
        <Badge variant="secondary" className="border border-alfie-mint/40 bg-alfie-mintSoft text-slate-700 text-xs sm:text-sm">
          Agent IA de Création Visuelle
        </Badge>

        <div className="space-y-3 sm:space-y-4">
          <h1 className="text-center text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight text-slate-900 leading-tight px-2">
            Crée des designs{" "}
            <span className="relative inline-flex items-center justify-center min-w-[10ch] sm:min-w-[12ch]">
              <span className="bg-gradient-to-r from-[#7fdce2] via-[#c99df8] to-[#ff9fd4] bg-clip-text text-transparent transition-opacity duration-300">
                {typedText || "\u00A0"}
              </span>
              <span
                className="ml-1 inline-block h-6 sm:h-8 w-[2px] animate-pulse rounded bg-alfie-mint align-middle"
                aria-hidden="true"
              />
            </span>{" "}
            en quelques secondes
          </h1>
          <p className="mx-auto max-w-2xl text-sm sm:text-base md:text-lg text-slate-600 px-4">
            Alfie génère tes visuels pour tous les réseaux sociaux : posts, carrousels et reels. Pas de design, juste tes idées.
          </p>
        </div>

        <div className="flex w-full flex-col items-center justify-center gap-3 sm:gap-4 px-4">
          <Button
            className="h-11 sm:h-12 w-full sm:w-auto rounded-full bg-alfie-mint px-6 sm:px-8 text-sm sm:text-base text-slate-900 hover:bg-alfie-pink min-w-[200px]"
            onClick={goToStart}
          >
            Créer mon Brand Kit (1 min)
          </Button>
          <p className="text-xs text-slate-500">3 visuels gratuits en 5 min. Sans carte. Livraison ZIP + CSV Canva.</p>
          <Button
            variant="outline"
            className="h-11 sm:h-12 w-full sm:w-auto rounded-full border-slate-200 bg-white/80 px-6 sm:px-8 text-sm sm:text-base text-slate-900 hover:bg-slate-100 min-w-[200px]"
            onClick={scrollToDemo}
          >
            Voir la démo (30 sec) →
          </Button>
          <button
            onClick={scrollToPricing}
            className="text-sm text-slate-500 underline underline-offset-2 hover:text-slate-700 transition-colors"
          >
            Voir les tarifs
          </button>
        </div>

        <div className="mt-4 sm:mt-8 flex flex-wrap justify-center gap-2 sm:gap-3 px-2">
          {featurePills.map((feature) => (
            <div
              key={feature.label}
              className="flex items-center gap-2 rounded-full border border-slate-200/80 bg-white px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm text-slate-700 shadow-sm"
            >
              <feature.icon className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-alfie-mint" />
              <span>{feature.label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

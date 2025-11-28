import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import logo from "@/assets/alfie-logo-black.svg";
export function LandingHeader() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleScroll = () => {
      setScrolled(window.scrollY > 40);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);
  return <header className={["fixed inset-x-0 top-0 z-40 transition-all duration-300", scrolled ? "bg-white/95 backdrop-blur border-b border-slate-200 shadow-sm" : "bg-transparent border-b border-transparent"].join(" ")}>
      <div className="mx-auto flex max-w-6xl items-center justify-between px-3 sm:px-4 py-2 sm:py-3">
        {/* Logo + nom */}
        <Link to="/" className="flex items-center gap-2 sm:gap-3">
          <img src={logo} alt="Logo Alfie Designer" className="h-7 sm:h-8 w-auto" aria-hidden="true" />
          <span className="sr-only">Alfie Designer</span>
        </Link>

        {/* Boutons à droite */}
        <div className="flex items-center gap-2 sm:gap-3">
          <Button asChild className="bg-slate-900 text-white hover:bg-slate-800 text-sm sm:text-base px-3 sm:px-4 h-9 sm:h-10">
            <Link to="/app">Ouvrir l'app</Link>
          </Button>
        </div>
      </div>
    </header>;
}
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import logo from "@/assets/alfie-logo.jpg";

export function LandingHeader() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 40);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header
      className={[
        "fixed inset-x-0 top-0 z-40 transition-all duration-300",
        scrolled
          ? "bg-white/95 backdrop-blur border-b border-slate-200 shadow-sm"
          : "bg-transparent border-b border-transparent",
      ].join(" ")}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link to="/" className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/90 shadow-md">
            <img src={logo} alt="Alfie Designer" className="h-6 w-6 object-contain" />
          </div>
          <span className="text-sm font-semibold text-slate-900 md:text-base">Alfie Designer</span>
        </Link>

        <Button
          asChild
          className="rounded-full bg-alfie-mint px-4 text-slate-900 transition-colors hover:bg-alfie-pink md:px-5"
        >
          <a href="/app">Ouvrir l’app →</a>
        </Button>
      </div>
    </header>
  );
}

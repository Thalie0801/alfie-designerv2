import logoBlack from "@/assets/alfie-logo-black.svg";
import logoWhite from "@/assets/alfie-logo-white.svg";
import { Sparkles } from "lucide-react";

export function LandingFooter() {
  return (
    <footer className="bg-muted/30 px-4 py-12 sm:px-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 grid gap-8 md:grid-cols-4">
          <div>
            <div className="mb-4 flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-alfie-mint via-alfie-lilac to-alfie-pink">
                <Sparkles className="h-4 w-4 text-white" />
              </div>
              <span className="font-bold">Alfie Designer</span>
            </div>
            <p className="text-sm text-muted-foreground">
              L'agent IA qui transforme tes idées en designs professionnels
            </p>
          </div>

          <div>
            <h4 className="mb-4 font-semibold">Produit</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <a href="/demo" className="transition-colors hover:text-foreground">
                  Démo
                </a>
              </li>
              <li>
                <a href="#pricing" className="transition-colors hover:text-foreground">
                  Tarifs
                </a>
              </li>
              <li>
                <a href="/dashboard" className="transition-colors hover:text-foreground">
                  Dashboard
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="mb-4 font-semibold">Ressources</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <a href="/faq" className="transition-colors hover:text-foreground">
                  FAQ
                </a>
              </li>
              <li>
                <a href="/contact" className="transition-colors hover:text-foreground">
                  Support
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="mb-4 font-semibold">Légal</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <a href="/legal" className="transition-colors hover:text-foreground">
                  Mentions légales
                </a>
              </li>
              <li>
                <a href="/privacy" className="transition-colors hover:text-foreground">
                  Confidentialité
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-border/50 pt-8 text-center text-sm text-muted-foreground">
          <div className="flex flex-col items-center gap-4">
            <img src={logoBlack} alt="Alfie Designer" className="h-10 w-auto dark:hidden" />
            <img src={logoWhite} alt="Alfie Designer" className="hidden h-10 w-auto dark:block" />
            <p>© 2025 Alfie Designer. Tous droits réservés.</p>
          </div>
        </div>
      </div>
    </footer>
  );
}

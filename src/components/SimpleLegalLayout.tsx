import { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

interface SimpleLegalLayoutProps {
  children: ReactNode;
}

export function SimpleLegalLayout({ children }: SimpleLegalLayoutProps) {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 sm:h-16 items-center justify-between px-3 sm:px-4">
          <div className="flex items-center gap-3 sm:gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/')}
              className="gap-2 text-xs sm:text-sm px-2 sm:px-3"
            >
              <ArrowLeft className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Retour à l'accueil</span>
              <span className="sm:hidden">Retour</span>
            </Button>
            <div className="font-semibold text-sm sm:text-base lg:text-lg">Alfie Designer</div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 lg:py-8">
        {children}
      </main>

      <footer className="border-t mt-8 sm:mt-12">
        <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 text-center text-xs sm:text-sm text-muted-foreground">
          <p>© 2025 Alfie Designer - Tous droits réservés</p>
        </div>
      </footer>
    </div>
  );
}

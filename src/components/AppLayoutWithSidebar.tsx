import { ReactNode, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { useAuth } from "@/hooks/useAuth";
import { AppSidebar } from "@/components/AppSidebar";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { ThemeToggle } from "@/components/ThemeToggle";

interface AppLayoutWithSidebarProps {
  children: ReactNode;
}

// Petit fallback local pour ne pas casser le build si le vrai composant n'existe pas encore
interface SubscriptionExpiredModalProps {
  open: boolean;
  onRenew: () => void;
}

const SubscriptionExpiredModal = ({ open, onRenew }: SubscriptionExpiredModalProps) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-card border border-border rounded-xl p-4 max-w-sm w-full shadow-lg">
        <h2 className="font-semibold mb-2">Abonnement expiré</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Ton abonnement a expiré. Clique sur &quot;Renouveler&quot; pour aller sur la
          page d&apos;abonnement.
        </p>
        <div className="flex justify-end">
          <button
            type="button"
            onClick={onRenew}
            className="inline-flex items-center justify-center rounded-md bg-alfie-mint px-3 py-1.5 text-sm font-medium text-slate-900 hover:bg-alfie-pink transition-colors"
          >
            Renouveler
          </button>
        </div>
      </div>
    </div>
  );
};

export function AppLayoutWithSidebar({ children }: AppLayoutWithSidebarProps) {
  const { subscriptionExpired, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [showExpiredModal, setShowExpiredModal] = useState(false);

  useEffect(() => {
    if (subscriptionExpired && !isAdmin) {
      setShowExpiredModal(true);
    }
  }, [subscriptionExpired, isAdmin]);

  const handleRenew = () => {
    navigate("/billing");
    setShowExpiredModal(false);
  };

  return (
    <>
      <SubscriptionExpiredModal open={showExpiredModal} onRenew={handleRenew} />
      <SidebarProvider defaultOpen={true}>
        <div className="min-h-screen flex w-full bg-background text-foreground">
          <AppSidebar />

          <div className="flex-1 flex flex-col min-w-0">
            {/* Header mobile */}
            <header className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b bg-card/70 backdrop-blur px-3 sm:px-4 py-2 lg:hidden">
              <div className="flex items-center gap-2 sm:gap-3">
                <SidebarTrigger className="touch-target" />
                <h1 className="font-semibold text-sm sm:text-base truncate">
                  Alfie Designer
                </h1>
              </div>
              <ThemeToggle className="touch-target" />
            </header>

            {/* Header desktop */}
            <div className="hidden lg:flex items-center justify-between p-2 border-b">
              <SidebarTrigger />
              <ThemeToggle />
            </div>

            {/* Contenu principal */}
            <main className="flex-1 p-2 sm:p-3 lg:p-6 max-w-7xl w-full mx-auto">
              {children}
            </main>
          </div>
        </div>
      </SidebarProvider>
    </>
  );
}

export default AppLayoutWithSidebar;

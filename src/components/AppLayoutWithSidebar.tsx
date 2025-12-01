import { ReactNode, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { useAuth } from "@/hooks/useAuth";
import { AppSidebar } from "@/components/AppSidebar";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { useIsMobile } from "@/hooks/use-mobile";

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

function LayoutContent({ children }: { children: ReactNode }) {
  const isMobile = useIsMobile();
  
  return (
    <div className="min-h-screen flex flex-col w-full bg-background text-foreground">
      {isMobile && (
        <header className="sticky top-0 z-40 h-14 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 flex items-center px-4 gap-3">
          <SidebarTrigger />
          <span className="font-semibold text-lg">Alfie Designer</span>
        </header>
      )}
      
      <div className="flex flex-1 w-full">
        <AppSidebar />
        
        <main className="flex-1 p-3 sm:p-4 lg:p-6 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}

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
        <LayoutContent>{children}</LayoutContent>
      </SidebarProvider>
    </>
  );
}

export default AppLayoutWithSidebar;

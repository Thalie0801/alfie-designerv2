import { ReactNode, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { useAuth } from "@/hooks/useAuth";
import { SubscriptionExpiredModal } from "@/components/billing/SubscriptionExpiredModal";
import { AppSidebar } from "@/components/AppSidebar";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { ThemeToggle } from "@/components/ThemeToggle";

interface AppLayoutWithSidebarProps {
  children: ReactNode;
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
        <div className="min-h-screen flex w-full bg-background text-foreground">
          <AppSidebar />

          <div className="flex-1 flex flex-col min-w-0">
            {/* Header mobile */}
            <header className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b bg-card/70 backdrop-blur px-3 sm:px-4 py-2 lg:hidden">
              <div className="flex items-center gap-2 sm:gap-3">
                <SidebarTrigger className="touch-target" />
                <h1 className="font-semibold text-sm sm:text-base truncate">Alfie Designer</h1>
              </div>
              <ThemeToggle className="touch-target" />
            </header>

            {/* Header desktop */}
            <div className="hidden lg:flex items-center justify-between p-2 border-b">
              <SidebarTrigger />
              <ThemeToggle />
            </div>

            {/* Contenu principal */}
            <main className="flex-1 p-2 sm:p-3 lg:p-6 max-w-7xl w-full mx-auto">{children}</main>
          </div>
        </div>
      </SidebarProvider>
    </>
  );
}

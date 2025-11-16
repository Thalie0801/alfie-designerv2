iimport { ReactNode, useEffect, useState } from "react";
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
            className="inline-flex items-center justify-center rounded-md bg-alfie-primary px-3 py-1.5 text-sm font-medium text-white hover:bg-alfie-pink transition-colors"
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

// 🔁 On fournit aussi un export par défaut pour être sûr
export default AppLayoutWithSidebar;


  const navItems = [
    { path: "/chat", label: "Chat Alfie", icon: Sparkles },
    { path: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { path: "/billing", label: "Abonnement", icon: CreditCard },
  ];

  if (canSeeAdminToggle) {
    navItems.push({ path: "/admin", label: "Admin", icon: Settings });
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-20 backdrop-blur bg-card/80 border-b border-border">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 py-2 sm:py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-6">
            <Link to="/chat" className="flex items-center gap-1.5 sm:gap-2">
              <span className="inline-flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-2xl bg-alfie-primary/10 text-alfie-primary shadow-sm">
                <Sparkles className="h-4 w-4 sm:h-5 sm:w-5" />
              </span>
              <span className="font-semibold text-sm sm:text-base">Alfie Designer</span>
            </Link>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center gap-1">
              {navItems.map((item) => (
                <Link key={item.path} to={item.path}>
                  <Button variant={location.pathname === item.path ? "default" : "ghost"} size="sm" className="gap-2">
                    <item.icon className="h-4 w-4" />
                    {item.label}
                  </Button>
                </Link>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-3">
            {/* Admin Quick Switch - Hidden on small mobile */}
            {canSeeAdminToggle && (
              <div className="hidden sm:flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1 rounded-lg bg-muted text-foreground border border-border">
                <Link to="/chat">
                  <Button
                    variant={location.pathname === "/chat" ? "default" : "ghost"}
                    size="sm"
                    className="text-xs sm:text-sm px-2 sm:px-3"
                    aria-label="Basculer vers le mode Client"
                  >
                    👤 Client
                  </Button>
                </Link>
                <Link to="/admin">
                  <Button
                    variant={location.pathname === "/admin" ? "default" : "ghost"}
                    size="sm"
                    className="text-xs sm:text-sm px-2 sm:px-3"
                    aria-label="Basculer vers le mode Admin"
                  >
                    ⚙️ Admin
                  </Button>
                </Link>
              </div>
            )}

            {/* Badge plan */}
            <Badge
              variant="secondary"
              className={cn(
                "hidden sm:inline-flex text-xs",
                (profile?.plan || "starter").toLowerCase() === "free" &&
                  "bg-alfie-aqua/10 text-alfie-aqua border border-alfie-aqua/40",
              )}
            >
              {profile?.plan || "starter"}
            </Badge>

            {/* Icônes user + déconnexion desktop */}
            <Button variant="ghost" size="icon" className="hidden sm:flex h-8 w-8 sm:h-10 sm:w-10">
              <UserCircle className="h-4 w-4 sm:h-5 sm:w-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleSignOut}
              className="hidden sm:flex h-8 w-8 sm:h-10 sm:w-10"
            >
              <LogOut className="h-4 w-4 sm:h-5 sm:w-5" />
            </Button>

            {/* Mobile Menu */}
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild className="md:hidden">
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[280px] sm:w-[320px]">
                <div className="flex flex-col gap-4 mt-6">
                  <div className="flex items-center gap-2 pb-4 border-b border-border">
                    <UserCircle className="h-5 w-5 text-muted-foreground" />
                    <div className="flex flex-col">
                      <span className="text-sm font-medium">{user?.email}</span>
                      <Badge variant="secondary" className="w-fit text-xs mt-1">
                        {profile?.plan || "starter"}
                      </Badge>
                    </div>
                  </div>

                  <nav className="flex flex-col gap-2">
                    {navItems.map((item) => (
                      <Link key={item.path} to={item.path} onClick={() => setMobileMenuOpen(false)}>
                        <Button
                          variant={location.pathname === item.path ? "default" : "ghost"}
                          className="w-full justify-start gap-3"
                        >
                          <item.icon className="h-5 w-5" />
                          {item.label}
                        </Button>
                      </Link>
                    ))}
                  </nav>

                  {canSeeAdminToggle && (
                    <div className="pt-4 border-t border-border">
                      <p className="text-xs text-muted-foreground mb-2 px-2">Mode</p>
                      <div className="flex flex-col gap-2">
                        <Link to="/chat" onClick={() => setMobileMenuOpen(false)}>
                          <Button
                            variant={location.pathname === "/chat" ? "default" : "outline"}
                            className="w-full justify-start"
                          >
                            👤 Client
                          </Button>
                        </Link>
                        <Link to="/admin" onClick={() => setMobileMenuOpen(false)}>
                          <Button
                            variant={location.pathname === "/admin" ? "default" : "outline"}
                            className="w-full justify-start"
                          >
                            ⚙️ Admin
                          </Button>
                        </Link>
                      </div>
                    </div>
                  )}

                  <div className="pt-4 border-t border-border mt-auto">
                    <Button
                      variant="outline"
                      className="w-full justify-start gap-3 text-destructive hover:text-destructive"
                      onClick={() => {
                        setMobileMenuOpen(false);
                        handleSignOut();
                      }}
                    >
                      <LogOut className="h-5 w-5" />
                      Déconnexion
                    </Button>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-6">{children}</main>
    </div>
  );
}

import { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';
import { ThemeToggle } from '@/components/ThemeToggle';
import { TourProvider, HelpLauncher } from '@/components/tour/InteractiveTour';
import { DashboardTourAutoStart } from '@/components/tour/DashboardTourAutoStart';
import { useAuth } from '@/hooks/useAuth';

interface AppLayoutWithSidebarProps {
  children: ReactNode;
}

export function AppLayoutWithSidebar({ children }: AppLayoutWithSidebarProps) {
  const location = useLocation();
  const { user } = useAuth();

  return (
    <TourProvider options={{ userEmail: user?.email }}>
      <SidebarProvider defaultOpen={true}>
        <div className="min-h-screen flex w-full bg-background">
          <AppSidebar />
          
          <div className="flex-1 flex flex-col min-w-0">
            {/* Header avec trigger pour mobile */}
            <header className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b bg-card/70 backdrop-blur px-3 sm:px-4 py-2 sm:py-3 lg:hidden">
              <div className="flex items-center gap-3 sm:gap-4">
                <SidebarTrigger />
                <h1 className="font-semibold text-sm sm:text-base">Alfie Designer</h1>
              </div>
              <div className="flex items-center gap-2">
                <HelpLauncher />
                <ThemeToggle />
              </div>
            </header>

            {/* Header desktop */}
            <div className="hidden lg:flex items-center justify-between p-2 border-b">
              <SidebarTrigger />
              <div className="flex items-center gap-2">
                <HelpLauncher />
                <ThemeToggle />
              </div>
            </div>

            {/* Contenu principal */}
            <main className="flex-1 p-3 sm:p-4 lg:p-6 max-w-7xl w-full mx-auto">
              {location.pathname === '/dashboard' && <DashboardTourAutoStart />}
              {children}
            </main>
          </div>
        </div>
      </SidebarProvider>
    </TourProvider>
  );
}

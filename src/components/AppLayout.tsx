import { ReactNode, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { 
  Sparkles, 
  LayoutDashboard, 
  CreditCard, 
  Settings, 
  LogOut,
  UserCircle,
  Menu
} from 'lucide-react';

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, profile, isAdmin, roles, signOut } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Debug pour vérifier le rôle admin
  console.log('🔐 AppLayout Debug:', { 
    isAdmin, 
    roles, 
    userId: user?.id,
    email: user?.email 
  });
  const canSeeAdminToggle = isAdmin || (user?.email ? ['nathaliestaelens@gmail.com','staelensnathalie@gmail.com'].includes(user.email) : false);

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const navItems = [
    { path: '/app', label: 'Créer', icon: Sparkles },
    { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/billing', label: 'Abonnement', icon: CreditCard },
  ];

  if (canSeeAdminToggle) {
    navItems.push({ path: '/admin', label: 'Admin', icon: Settings });
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="sticky top-0 z-20 backdrop-blur bg-white/70 border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 py-2 sm:py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-6">
            <Link to="/app" className="flex items-center gap-1.5 sm:gap-2">
              <span className="inline-flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-sm">
                <Sparkles className="h-4 w-4 sm:h-5 sm:w-5" />
              </span>
              <span className="font-semibold text-sm sm:text-base">Alfie Designer</span>
            </Link>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center gap-1">
              {navItems.map((item) => (
                <Link key={item.path} to={item.path}>
                  <Button
                    variant={location.pathname === item.path ? 'default' : 'ghost'}
                    size="sm"
                    className="gap-2"
                  >
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
              <div className="hidden sm:flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1 rounded-lg bg-slate-100 border border-slate-200">
                <Link to="/app">
                  <Button 
                    variant={location.pathname === '/app' ? 'default' : 'ghost'} 
                    size="sm"
                    className="text-xs sm:text-sm px-2 sm:px-3"
                    aria-label="Basculer vers le mode Client"
                  >
                    👤 Client
                  </Button>
                </Link>
                <Link to="/admin">
                  <Button 
                    variant={location.pathname === '/admin' ? 'default' : 'ghost'} 
                    size="sm"
                    className="text-xs sm:text-sm px-2 sm:px-3"
                    aria-label="Basculer vers le mode Admin"
                  >
                    ⚙️ Admin
                  </Button>
                </Link>
              </div>
            )}
            <Badge variant="secondary" className="hidden sm:inline-flex text-xs">{profile?.plan || 'starter'}</Badge>
            <Button variant="ghost" size="icon" className="hidden sm:flex h-8 w-8 sm:h-10 sm:w-10">
              <UserCircle className="h-4 w-4 sm:h-5 sm:w-5" />
            </Button>
            <Button variant="ghost" size="icon" onClick={handleSignOut} className="hidden sm:flex h-8 w-8 sm:h-10 sm:w-10">
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
                  <div className="flex items-center gap-2 pb-4 border-b">
                    <UserCircle className="h-5 w-5 text-muted-foreground" />
                    <div className="flex flex-col">
                      <span className="text-sm font-medium">{user?.email}</span>
                      <Badge variant="secondary" className="w-fit text-xs mt-1">{profile?.plan || 'starter'}</Badge>
                    </div>
                  </div>

                  <nav className="flex flex-col gap-2">
                    {navItems.map((item) => (
                      <Link key={item.path} to={item.path} onClick={() => setMobileMenuOpen(false)}>
                        <Button
                          variant={location.pathname === item.path ? 'default' : 'ghost'}
                          className="w-full justify-start gap-3"
                        >
                          <item.icon className="h-5 w-5" />
                          {item.label}
                        </Button>
                      </Link>
                    ))}
                  </nav>

                  {canSeeAdminToggle && (
                    <div className="pt-4 border-t">
                      <p className="text-xs text-muted-foreground mb-2 px-2">Mode</p>
                      <div className="flex flex-col gap-2">
                        <Link to="/app" onClick={() => setMobileMenuOpen(false)}>
                          <Button 
                            variant={location.pathname === '/app' ? 'default' : 'outline'} 
                            className="w-full justify-start"
                          >
                            👤 Client
                          </Button>
                        </Link>
                        <Link to="/admin" onClick={() => setMobileMenuOpen(false)}>
                          <Button 
                            variant={location.pathname === '/admin' ? 'default' : 'outline'} 
                            className="w-full justify-start"
                          >
                            ⚙️ Admin
                          </Button>
                        </Link>
                      </div>
                    </div>
                  )}

                  <div className="pt-4 border-t mt-auto">
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
      <main className="max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
        {children}
      </main>
    </div>
  );
}

import { ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Sparkles, 
  LayoutDashboard, 
  CreditCard, 
  Settings, 
  LogOut,
  UserCircle
} from 'lucide-react';

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, profile, isAdmin, roles, signOut } = useAuth();

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
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link to="/app" className="flex items-center gap-2">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-sm">
                <Sparkles className="h-5 w-5" />
              </span>
              <span className="font-semibold">Alfie Designer</span>
            </Link>

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

          <div className="flex items-center gap-3">
            {/* Admin Quick Switch */}
            {canSeeAdminToggle && (
              <div className="flex items-center gap-2 px-3 py-1 rounded-lg bg-slate-100 border border-slate-200">
                <Link to="/app">
                  <Button 
                    variant={location.pathname === '/app' ? 'default' : 'ghost'} 
                    size="sm"
                    aria-label="Basculer vers le mode Client"
                  >
                    👤 Client
                  </Button>
                </Link>
                <Link to="/admin">
                  <Button 
                    variant={location.pathname === '/admin' ? 'default' : 'ghost'} 
                    size="sm"
                    aria-label="Basculer vers le mode Admin"
                  >
                    ⚙️ Admin
                  </Button>
                </Link>
              </div>
            )}
            <Badge variant="secondary">{profile?.plan || 'starter'}</Badge>
            <Button variant="ghost" size="icon">
              <UserCircle className="h-5 w-5" />
            </Button>
            <Button variant="ghost" size="icon" onClick={handleSignOut}>
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        {children}
      </main>
    </div>
  );
}

import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { 
  Sparkles, 
  LayoutDashboard, 
  CreditCard,
  TrendingUp,
  Settings,
  LogOut,
  UserCircle,
  Layers,
  FolderOpen
} from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  useSidebar,
} from '@/components/ui/sidebar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import alfieMain from '@/assets/alfie-main.png';

export function AppSidebar() {
  const { open } = useSidebar();
  const location = useLocation();
  const { user, profile, isAdmin, signOut } = useAuth();
  const canSeeAdminToggle = user?.email === 'nathaliestaelens@gmail.com';

  const navItems: Array<{
    path: string;
    label: string;
    icon: any;
    badge?: string;
  }> = [
    { path: '/app', label: 'Créer', icon: Sparkles },
    { path: '/templates', label: 'Catalogue', icon: Layers, badge: 'Bientôt' },
    { path: '/library', label: 'Bibliothèque', icon: FolderOpen },
    { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/profile', label: 'Profil', icon: UserCircle },
    { path: '/billing', label: 'Abonnement', icon: CreditCard },
    { path: '/affiliate', label: 'Affiliation', icon: TrendingUp },
  ];

  if (isAdmin || canSeeAdminToggle) {
    navItems.push({ path: '/admin', label: 'Admin', icon: Settings });
  }

  const isActive = (path: string) => location.pathname === path;
  const getNavCls = ({ isActive }: { isActive: boolean }) =>
    isActive ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium" : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground";

  const handleSignOut = async () => {
    await signOut();
    window.location.href = '/';
  };

  return (
    <Sidebar>
      <SidebarContent>
        {/* Logo */}
        <div className="p-4 flex items-center gap-3">
          <img src={alfieMain} alt="Alfie" className="w-10 h-10 object-contain" />
          {open && (
            <div>
              <p className="font-bold text-lg">Alfie</p>
              <p className="text-xs text-muted-foreground">Designer AI</p>
            </div>
          )}
        </div>

        <Separator />

        {/* Navigation */}
        <SidebarGroup>
          {open && <SidebarGroupLabel>Navigation</SidebarGroupLabel>}
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.path}>
                  <SidebarMenuButton asChild isActive={location.pathname === item.path}>
                    <NavLink to={item.path} end className={getNavCls}>
                      <item.icon className={open ? "mr-2" : "mx-auto"} size={20} />
                      {open && (
                        <div className="flex items-center gap-2 flex-1">
                          <span>{item.label}</span>
                          {item.badge && (
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                              {item.badge}
                            </Badge>
                          )}
                        </div>
                      )}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* Footer */}
      <SidebarFooter>
        <Separator />
        <div className="p-3 space-y-2">
          {open && (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <UserCircle className="h-4 w-4" />
                <span className="text-xs truncate max-w-[120px]">
                  {user?.email?.split('@')[0]}
                </span>
              </div>
              <Badge variant="secondary" className="text-xs">
                {profile?.plan || 'starter'}
              </Badge>
            </div>
          )}
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={handleSignOut}
            className="w-full justify-start"
          >
            <LogOut className={open ? "mr-2" : "mx-auto"} size={16} />
            {open && <span>Déconnexion</span>}
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}

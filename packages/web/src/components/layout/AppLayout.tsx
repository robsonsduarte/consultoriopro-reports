import { type ReactNode, useEffect, useState } from 'react';
import {
  LayoutDashboard,
  Calendar,
  Settings,
  Users,
  Building2,
  CreditCard,
} from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { useUiStore } from '@/stores/uiStore';
import { Sidebar, type NavLink } from '@/components/layout/Sidebar';
import { AppHeader } from '@/components/layout/AppHeader';
import { Sheet, SheetContent } from '@/components/ui/sheet';

const ADMIN_LINKS: NavLink[] = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/shifts', label: 'Turnos', icon: Calendar },
  { href: '/config', label: 'Config', icon: Settings },
  { href: '/users', label: 'Usuarios', icon: Users },
  { href: '/btg', label: 'BTG', icon: Building2 },
];

const USER_LINKS: NavLink[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/payment', label: 'Pagamentos', icon: CreditCard },
];

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const { user } = useAuthStore();
  const { sidebarCollapsed, toggleSidebar } = useUiStore();

  const isAdmin = user?.role === 'super_admin' || user?.role === 'admin';
  const links = isAdmin ? ADMIN_LINKS : USER_LINKS;

  const [mobileOpen, setMobileOpen] = useState(false);

  // Close mobile sheet when resizing to desktop
  useEffect(() => {
    function handleResize() {
      if (window.innerWidth >= 640) {
        setMobileOpen(false);
      }
    }
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Desktop sidebar (>= 1024px) — user-controlled collapse */}
      <div className="hidden lg:flex lg:shrink-0">
        <Sidebar
          links={links}
          collapsed={sidebarCollapsed}
          onToggle={toggleSidebar}
        />
      </div>

      {/* Medium screens (640-1023px) — icon-only sidebar, click opens mobile sheet */}
      <div className="hidden sm:flex lg:hidden shrink-0">
        <Sidebar
          links={links}
          collapsed={true}
          onToggle={() => setMobileOpen(true)}
        />
      </div>

      {/* Mobile sheet drawer (< 640px) */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent
          side="left"
          showCloseButton={false}
          className="w-60 p-0 gap-0"
        >
          <Sidebar
            links={links}
            collapsed={false}
            onToggle={() => setMobileOpen(false)}
          />
        </SheetContent>
      </Sheet>

      {/* Main content column */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <AppHeader
          onMenuClick={() => setMobileOpen(true)}
          showMonthPicker={true}
        />

        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}

// Re-export NavLink so consumers can type their link lists
export type { NavLink };

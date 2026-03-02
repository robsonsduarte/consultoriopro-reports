import type { LucideIcon } from 'lucide-react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Logo } from '@/components/domain/Logo';
import { NavItem } from '@/components/domain/NavItem';
import { cn } from '@/lib/utils';

export interface NavLink {
  href: string;
  label: string;
  icon: LucideIcon;
}

interface SidebarProps {
  links: NavLink[];
  collapsed: boolean;
  onToggle: () => void;
}

export function Sidebar({ links, collapsed, onToggle }: SidebarProps) {
  return (
    <aside
      className={cn(
        'flex h-full flex-col border-r border-sidebar-border bg-sidebar',
        'transition-[width] duration-200 ease-in-out',
        collapsed ? 'w-14' : 'w-60',
      )}
    >
      {/* Header / Logo */}
      <div
        className={cn(
          'flex h-14 shrink-0 items-center border-b border-sidebar-border',
          collapsed ? 'justify-center px-0' : 'px-4',
        )}
      >
        {collapsed ? (
          <Logo size="sm" />
        ) : (
          <Logo size="sm" />
        )}
        {!collapsed && (
          <span className="ml-2 font-semibold text-sidebar-foreground leading-none sr-only">
            ConsultorioPro
          </span>
        )}
      </div>

      {/* Navigation */}
      <nav
        className={cn(
          'flex flex-1 flex-col gap-1 overflow-y-auto overflow-x-hidden py-3',
          collapsed ? 'px-1' : 'px-2',
        )}
        aria-label="Navegacao principal"
      >
        {links.map((link) => (
          <NavItem
            key={link.href}
            href={link.href}
            label={link.label}
            icon={link.icon}
            collapsed={collapsed}
          />
        ))}
      </nav>

      {/* Footer — toggle button */}
      <div
        className={cn(
          'flex shrink-0 items-center border-t border-sidebar-border py-3',
          collapsed ? 'justify-center px-0' : 'justify-end px-3',
        )}
      >
        <button
          onClick={onToggle}
          className={cn(
            'flex items-center justify-center rounded-md p-1.5 text-sidebar-foreground/60',
            'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
            'transition-colors',
          )}
          aria-label={collapsed ? 'Expandir sidebar' : 'Recolher sidebar'}
          title={collapsed ? 'Expandir sidebar' : 'Recolher sidebar'}
        >
          {collapsed ? (
            <ChevronRight className="size-4" />
          ) : (
            <ChevronLeft className="size-4" />
          )}
        </button>
      </div>
    </aside>
  );
}

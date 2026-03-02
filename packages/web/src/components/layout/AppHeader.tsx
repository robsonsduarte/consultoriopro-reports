import { Menu } from 'lucide-react';
import { MonthPicker } from '@/components/domain/MonthPicker';
import { UserMenu } from '@/components/layout/UserMenu';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface AppHeaderProps {
  onMenuClick: () => void;
  showMonthPicker?: boolean;
}

export function AppHeader({ onMenuClick, showMonthPicker = true }: AppHeaderProps) {
  return (
    <header
      className={cn(
        'flex h-14 shrink-0 items-center gap-3 border-b border-border bg-background px-4',
      )}
    >
      {/* Hamburger — visible only on mobile */}
      <Button
        variant="ghost"
        size="icon"
        onClick={onMenuClick}
        className="shrink-0 lg:hidden"
        aria-label="Abrir menu"
      >
        <Menu className="size-5" />
      </Button>

      {/* Month picker area */}
      {showMonthPicker && (
        <div className="flex items-center gap-2">
          <span className="hidden text-sm text-muted-foreground sm:inline">
            Competencia:
          </span>
          <MonthPicker />
        </div>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* User menu */}
      <UserMenu />
    </header>
  );
}

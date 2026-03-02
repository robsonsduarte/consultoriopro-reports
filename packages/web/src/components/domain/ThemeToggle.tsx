import { Sun, Moon, Monitor } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useUiStore } from '@/stores/uiStore';

const CYCLE: Array<'light' | 'dark' | 'system'> = ['light', 'dark', 'system'];

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useUiStore();

  function cycle() {
    const idx = CYCLE.indexOf(theme);
    const next = CYCLE[(idx + 1) % CYCLE.length] ?? 'system';
    setTheme(next);
  }

  const Icon = theme === 'dark' ? Moon : theme === 'light' ? Sun : Monitor;
  const label =
    theme === 'dark' ? 'Modo escuro' : theme === 'light' ? 'Modo claro' : 'Tema do sistema';

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={cycle}
      className={className}
      aria-label={label}
      title={label}
    >
      <Icon className="size-4" />
    </Button>
  );
}

import { Activity } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LogoProps {
  variant?: 'default' | 'light';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizes = {
  sm: { icon: 'size-5', text: 'text-lg', sub: 'text-xs' },
  md: { icon: 'size-6', text: 'text-xl', sub: 'text-xs' },
  lg: { icon: 'size-8', text: 'text-2xl', sub: 'text-sm' },
};

export function Logo({ variant = 'default', size = 'md', className }: LogoProps) {
  const s = sizes[size];
  const isLight = variant === 'light';

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div
        className={cn(
          'flex items-center justify-center rounded-lg p-1.5',
          isLight ? 'bg-white/20' : 'bg-primary/10',
        )}
      >
        <Activity className={cn(s.icon, isLight ? 'text-white' : 'text-primary')} />
      </div>
      <div className="flex flex-col">
        <span
          className={cn(
            s.text,
            'font-bold tracking-tight leading-none',
            isLight ? 'text-white' : 'text-foreground',
          )}
        >
          ConsultorioPro
        </span>
        <span
          className={cn(
            s.sub,
            'font-medium tracking-wide leading-none mt-0.5',
            isLight ? 'text-white/70' : 'text-muted-foreground',
          )}
        >
          Reports
        </span>
      </div>
    </div>
  );
}

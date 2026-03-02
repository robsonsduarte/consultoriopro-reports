import type { LucideIcon } from 'lucide-react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface StatCardProps {
  title: string;
  value: string;
  subtitle?: string;
  icon?: LucideIcon;
  trend?: 'up' | 'down' | 'neutral';
  className?: string;
}

const trendConfig = {
  up: {
    Icon: TrendingUp,
    className: 'text-green-600 dark:text-green-400',
  },
  down: {
    Icon: TrendingDown,
    className: 'text-red-600 dark:text-red-400',
  },
  neutral: {
    Icon: Minus,
    className: 'text-muted-foreground',
  },
} as const;

export function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  className,
}: StatCardProps) {
  const trendMeta = trend ? trendConfig[trend] : null;

  return (
    <Card className={cn('gap-3 py-5', className)}>
      <CardHeader className="pb-0">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {title}
          </CardTitle>
          {Icon && (
            <div className="flex size-8 items-center justify-center rounded-md bg-primary/10 text-primary shrink-0">
              <Icon className="size-4" />
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        <div className="flex flex-col gap-1">
          {/* Value — nunca truncar, wrap se necessario */}
          <p className="text-2xl font-bold leading-tight break-words">
            {value}
          </p>

          {(subtitle || trendMeta) && (
            <div className="flex items-center gap-1.5">
              {trendMeta && (
                <trendMeta.Icon
                  className={cn('size-3.5 shrink-0', trendMeta.className)}
                />
              )}
              {subtitle && (
                <p className="text-xs text-muted-foreground">{subtitle}</p>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

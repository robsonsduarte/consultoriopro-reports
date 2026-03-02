import type { ReleaseStatus } from '@cpro/shared';
import { cn } from '@/lib/utils';

interface StatusSummaryBarProps {
  counts: Record<ReleaseStatus, number>;
  className?: string;
}

type StatusMeta = {
  label: string;
  pillClassName: string;
};

const STATUS_META: Record<ReleaseStatus, StatusMeta> = {
  pending: {
    label: 'Pendente',
    pillClassName:
      'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  },
  approved: {
    label: 'Aprovado',
    pillClassName:
      'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  },
  contested: {
    label: 'Contestado',
    pillClassName:
      'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  },
  in_review: {
    label: 'Em Revisao',
    pillClassName:
      'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  },
  resolved: {
    label: 'Resolvido',
    pillClassName:
      'bg-gray-100 text-gray-800 dark:bg-gray-800/50 dark:text-gray-300',
  },
};

// Ordem de exibicao dos status
const STATUS_ORDER: ReleaseStatus[] = [
  'pending',
  'contested',
  'in_review',
  'approved',
  'resolved',
];

export function StatusSummaryBar({ counts, className }: StatusSummaryBarProps) {
  const visibleStatuses = STATUS_ORDER.filter((s) => (counts[s] ?? 0) > 0);

  if (visibleStatuses.length === 0) return null;

  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-x-2 gap-y-1.5',
        className,
      )}
      aria-label="Resumo de status"
    >
      {visibleStatuses.map((status, idx) => {
        const meta = STATUS_META[status];
        const count = counts[status];

        return (
          <div key={status} className="flex items-center gap-2">
            <span
              className={cn(
                'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap',
                meta.pillClassName,
              )}
            >
              {meta.label}
              <span className="font-bold">({count})</span>
            </span>

            {/* Separador entre pills */}
            {idx < visibleStatuses.length - 1 && (
              <span className="text-muted-foreground/40 text-xs" aria-hidden>
                ·
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

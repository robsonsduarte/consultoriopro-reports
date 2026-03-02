import type { ReleaseStatus } from '@cpro/shared';
import { cn } from '@/lib/utils';

interface ReleaseStatusBadgeProps {
  status: ReleaseStatus;
  className?: string;
}

const statusConfig: Record<
  ReleaseStatus,
  { label: string; className: string }
> = {
  pending: {
    label: 'Pendente',
    className:
      'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  },
  approved: {
    label: 'Aprovado',
    className:
      'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  },
  contested: {
    label: 'Contestado',
    className:
      'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  },
  in_review: {
    label: 'Em Revisao',
    className:
      'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  },
  resolved: {
    label: 'Resolvido',
    className:
      'bg-gray-100 text-gray-800 dark:bg-gray-800/50 dark:text-gray-300',
  },
};

export function ReleaseStatusBadge({
  status,
  className,
}: ReleaseStatusBadgeProps) {
  const config = statusConfig[status];

  return (
    <span
      className={cn(
        'inline-flex w-fit items-center rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap',
        config.className,
        className,
      )}
    >
      {config.label}
    </span>
  );
}

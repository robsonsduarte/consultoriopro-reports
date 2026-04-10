import { History, Radio } from 'lucide-react';
import type { ReportSnapshotMeta } from '@/hooks/useApi';
import { cn } from '@/lib/utils';

interface SnapshotVersionBadgeProps {
  meta?: ReportSnapshotMeta;
  className?: string;
}

function formatDatePtBr(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function SnapshotVersionBadge({ meta, className }: SnapshotVersionBadgeProps) {
  if (!meta) return null;

  if (meta.source === 'snapshot') {
    const label = meta.version ? `v${meta.version}` : 'versao';
    const date = meta.createdAt ? ` · ${formatDatePtBr(meta.createdAt)}` : '';
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap',
          'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
          className,
        )}
        title={meta.name ?? ''}
      >
        <History className="size-3" />
        {label}{date}
      </span>
    );
  }

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap',
        'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
        className,
      )}
    >
      <Radio className="size-3" />
      Live
    </span>
  );
}

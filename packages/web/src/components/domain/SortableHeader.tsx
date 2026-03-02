import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SortableHeaderProps {
  label: string;
  sortKey: string;
  currentKey: string;
  currentDir: 'asc' | 'desc';
  onSort: (key: string) => void;
  className?: string;
}

export function SortableHeader({
  label,
  sortKey,
  currentKey,
  currentDir,
  onSort,
  className,
}: SortableHeaderProps) {
  const isActive = sortKey === currentKey;

  return (
    <button
      type="button"
      onClick={() => onSort(sortKey)}
      className={cn(
        'group inline-flex items-center gap-1 text-xs font-medium uppercase tracking-wide',
        'cursor-pointer select-none transition-colors',
        isActive
          ? 'text-foreground'
          : 'text-muted-foreground hover:text-foreground',
        className,
      )}
    >
      <span>{label}</span>

      {isActive ? (
        currentDir === 'asc' ? (
          <ChevronUp className="size-3.5 text-primary" />
        ) : (
          <ChevronDown className="size-3.5 text-primary" />
        )
      ) : (
        <ChevronsUpDown className="size-3.5 opacity-40 group-hover:opacity-70 transition-opacity" />
      )}
    </button>
  );
}

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useProfessionals } from '@/hooks/useApi';

interface ProfessionalSelectProps {
  value: string;
  onChange: (id: string) => void;
  className?: string;
}

export function ProfessionalSelect({
  value,
  onChange,
  className,
}: ProfessionalSelectProps) {
  const { data: professionals, isLoading } = useProfessionals();

  if (isLoading) {
    return <Skeleton className={className ?? 'h-9 w-full'} />;
  }

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className={className}>
        <SelectValue placeholder="Selecione um profissional" />
      </SelectTrigger>
      <SelectContent>
        {(professionals ?? []).map((p) => (
          <SelectItem key={p.id} value={String(p.id)}>
            {p.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

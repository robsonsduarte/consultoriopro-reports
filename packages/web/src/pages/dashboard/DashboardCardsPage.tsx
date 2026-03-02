import { useNavigate } from 'react-router-dom';
import { CalendarDays, ChevronRight } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { mockMonthSummary } from '@/lib/mockData';
import { formatMonth } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { ReleaseStatus } from '@cpro/shared';
import type { MonthSummary } from '@/lib/mockData';

// Configuracao visual de cada status para os pills dos cards
const STATUS_PILL_CONFIG: Record<
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

const STATUS_ORDER: ReleaseStatus[] = [
  'pending',
  'contested',
  'in_review',
  'approved',
  'resolved',
];

function MonthCard({
  summary,
  onClick,
}: {
  summary: MonthSummary;
  onClick: () => void;
}) {
  const visibleStatuses = STATUS_ORDER.filter(
    (s) => (summary.counts[s] ?? 0) > 0,
  );

  return (
    <Card
      className="cursor-pointer gap-3 py-5 hover:border-primary/50 hover:shadow-md transition-all"
      onClick={onClick}
    >
      <CardHeader className="pb-0">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-md bg-primary/10 text-primary">
              <CalendarDays className="size-4" />
            </div>
            <CardTitle className="text-base font-semibold">
              {formatMonth(summary.month)}
            </CardTitle>
          </div>
          <ChevronRight className="size-4 text-muted-foreground" />
        </div>
      </CardHeader>

      <CardContent className="pt-0 space-y-3">
        {/* Total de profissionais */}
        <p className="text-xs text-muted-foreground">
          {summary.totalProfessionals}{' '}
          {summary.totalProfessionals === 1 ? 'profissional' : 'profissionais'}
        </p>

        {/* Pills de status */}
        {visibleStatuses.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {visibleStatuses.map((status) => {
              const config = STATUS_PILL_CONFIG[status];
              const count = summary.counts[status];
              return (
                <span
                  key={status}
                  className={cn(
                    'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap',
                    config.className,
                  )}
                >
                  {config.label}
                  <span className="font-bold">({count})</span>
                </span>
              );
            })}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground italic">
            Sem liberacoes registradas
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export function DashboardCardsPage() {
  const navigate = useNavigate();

  function handleCardClick(month: string) {
    navigate(`/?month=${month}`);
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Cabecalho */}
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold">Visao por Mes</h1>
          <p className="text-sm text-muted-foreground">
            Selecione um mes para ver o detalhamento dos profissionais.
          </p>
        </div>

        {/* Grid de cards mensais */}
        {mockMonthSummary.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <CalendarDays className="size-10 text-muted-foreground mb-3" />
            <p className="text-muted-foreground">
              Nenhum mes com dados encontrado.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {mockMonthSummary.map((summary) => (
              <MonthCard
                key={summary.month}
                summary={summary}
                onClick={() => handleCardClick(summary.month)}
              />
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}

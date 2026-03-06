import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import {
  Table2,
  LayoutGrid,
  Download,
  ChevronRight,
  SendHorizonal,
  DollarSign,
  Receipt,
  Clock,
  Banknote,
  RefreshCw,
} from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { StatusSummaryBar } from '@/components/domain/StatusSummaryBar';
import { ReleaseStatusBadge } from '@/components/domain/ReleaseStatusBadge';
import { SortableHeader } from '@/components/domain/SortableHeader';
import { ConfirmDialog } from '@/components/domain/ConfirmDialog';
import { StatCard } from '@/components/domain/StatCard';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';
import { useSortableTable } from '@/hooks/useSortableTable';
import { useDashboardProfessionals, useReleaseAll, useSyncTrigger, useSyncStatus, useSyncProgress } from '@/hooks/useApi';
import type { ProfessionalReport } from '@/hooks/useApi';
import { formatCurrency, formatMonth } from '@/lib/format';
import { useUiStore } from '@/stores/uiStore';
import { cn } from '@/lib/utils';
import type { ReleaseStatus } from '@cpro/shared';

type ViewMode = 'table' | 'cards';

function TableSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full rounded-md" />
      ))}
    </div>
  );
}

function ProfessionalCard({
  professional,
  onClick,
}: {
  professional: ProfessionalReport;
  onClick: () => void;
}) {
  return (
    <Card
      className="cursor-pointer gap-3 py-4 hover:bg-muted/50 transition-colors"
      onClick={onClick}
    >
      <CardContent>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-medium text-sm truncate">{professional.name}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {professional.specialty}
            </p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {professional.status && <ReleaseStatusBadge status={professional.status} />}
            {professional.isPaid && (
              <Badge className="bg-green-600 text-white hover:bg-green-600 text-[10px] px-1.5 h-5">
                Pago
              </Badge>
            )}
          </div>
        </div>

        <div className="mt-3 pt-3 border-t grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
          <div>
            <span className="text-muted-foreground">Receita</span>
            <p className="font-medium">{formatCurrency(professional.revenue)}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Liquido</span>
            <p className="font-medium text-primary">
              {formatCurrency(professional.netValue)}
            </p>
          </div>
          <div>
            <span className="text-muted-foreground">Imposto</span>
            <p className="font-medium">{formatCurrency(professional.tax)}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Turnos</span>
            <p className="font-medium">{professional.shifts}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function DashboardTablePage() {
  const navigate = useNavigate();
  const { currentMonth } = useUiStore();
  const qc = useQueryClient();

  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [syncJobId, setSyncJobId] = useState<string | null>(null);
  const releaseAll = useReleaseAll();
  const syncTrigger = useSyncTrigger();
  const { data: syncStatus } = useSyncStatus();
  const { data: syncProgress } = useSyncProgress(syncJobId);

  // Invalida o dashboard e os reports quando o job de sync completa.
  // O onSuccess do useSyncTrigger invalida imediatamente ao disparar o job,
  // mas os dados so estao prontos quando o job termina (status === 'completed').
  useEffect(() => {
    if (syncJobId && syncProgress?.status === 'completed') {
      void qc.invalidateQueries({ queryKey: ['dashboard'] });
      void qc.invalidateQueries({ queryKey: ['report'] });
      setSyncJobId(null);
    }
  }, [syncProgress, qc, syncJobId]);

  const { data, isLoading } = useDashboardProfessionals(currentMonth);
  const professionals = data ?? [];

  const { sorted, sortKey, sortDir, toggleSort } = useSortableTable<ProfessionalReport>(
    professionals,
    'name',
    'asc',
  );

  const statusCounts = useMemo(() => {
    const counts: Record<ReleaseStatus, number> = {
      pending: 0,
      approved: 0,
      contested: 0,
      in_review: 0,
      resolved: 0,
    };
    professionals.forEach((p) => {
      if (p.status) counts[p.status] = (counts[p.status] ?? 0) + 1;
    });
    return counts;
  }, [professionals]);

  const pendingCount = statusCounts.pending;

  const totals = useMemo(() => {
    return professionals.reduce(
      (acc, p) => ({
        revenue: acc.revenue + p.revenue,
        tax: acc.tax + p.tax,
        shifts: acc.shifts + p.shifts,
        netValue: acc.netValue + p.netValue,
      }),
      { revenue: 0, tax: 0, shifts: 0, netValue: 0 },
    );
  }, [professionals]);

  function handleRowClick(professional: ProfessionalReport) {
    navigate(`/report/${professional.id}?month=${currentMonth}`);
  }

  function handleExportCsv() {
    const headers = ['Nome', 'Receita', 'Imposto', 'Turnos', 'Liquido', 'Status'];
    const rows = professionals.map((p) => [
      p.name,
      p.revenue.toFixed(2),
      p.tax.toFixed(2),
      p.shifts,
      p.netValue.toFixed(2),
      p.status ?? '',
    ]);
    const csv = [headers, ...rows].map((r) => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `relatorio-${currentMonth}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function handleReleaseAll() {
    releaseAll.mutate(currentMonth, {
      onSuccess: () => setConfirmOpen(false),
    });
  }

  const monthLabel = formatMonth(currentMonth);

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Cabecalho da pagina */}
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-sm text-muted-foreground">{monthLabel}</p>
          {syncStatus?.lastSync && (
            <p className="text-xs text-muted-foreground">
              Dados atualizados em: {new Date(syncStatus.lastSync).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
            </p>
          )}
        </div>

        {/* Summary stats — so mostra quando tem dados */}
        {!isLoading && professionals.length > 0 && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard
              title="Receita Total"
              value={formatCurrency(totals.revenue)}
              icon={DollarSign}
              trend="up"
            />
            <StatCard
              title="Impostos"
              value={formatCurrency(totals.tax)}
              icon={Receipt}
            />
            <StatCard
              title="Total Turnos"
              value={String(totals.shifts)}
              icon={Clock}
            />
            <StatCard
              title="Liquido Total"
              value={formatCurrency(totals.netValue)}
              icon={Banknote}
              trend="up"
            />
          </div>
        )}

        {/* Toolbar */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {/* Status summary bar */}
          {!isLoading && (
            <StatusSummaryBar counts={statusCounts} />
          )}

          {/* Acoes */}
          <div className="flex items-center gap-2 sm:ml-auto">
            {/* Toggle tabela / cards */}
            <div className="flex rounded-md border overflow-hidden">
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 text-xs transition-colors',
                  viewMode === 'table'
                    ? 'bg-primary text-primary-foreground'
                    : 'hover:bg-muted text-muted-foreground',
                )}
                aria-label="Ver tabela"
              >
                <Table2 className="size-3.5" />
                <span className="hidden sm:inline">Tabela</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('cards')}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 text-xs transition-colors border-l',
                  viewMode === 'cards'
                    ? 'bg-primary text-primary-foreground'
                    : 'hover:bg-muted text-muted-foreground',
                )}
                aria-label="Ver cards"
              >
                <LayoutGrid className="size-3.5" />
                <span className="hidden sm:inline">Cards</span>
              </button>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                syncTrigger.mutate({ month: currentMonth }, {
                  onSuccess: (data) => {
                    if (data.jobId) setSyncJobId(data.jobId);
                  },
                });
              }}
              disabled={syncTrigger.isPending || syncProgress?.status === 'running'}
            >
              <RefreshCw className={cn('size-4', (syncTrigger.isPending || syncProgress?.status === 'running') && 'animate-spin')} />
              <span className="hidden sm:inline">
                {syncProgress?.status === 'running'
                  ? `Sincronizando ${syncProgress.completed}/${syncProgress.total}`
                  : 'Sincronizar'}
              </span>
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCsv}
              disabled={isLoading || professionals.length === 0}
            >
              <Download className="size-4" />
              <span className="hidden sm:inline">Exportar CSV</span>
            </Button>

            {pendingCount > 0 && (
              <Button
                size="sm"
                onClick={() => setConfirmOpen(true)}
                disabled={isLoading}
              >
                <SendHorizonal className="size-4" />
                <span>
                  Liberar Todos
                  <span className="ml-1 rounded-full bg-primary-foreground/20 px-1.5 py-0.5 text-xs">
                    {pendingCount}
                  </span>
                </span>
              </Button>
            )}
          </div>
        </div>

        {/* Conteudo principal */}
        {isLoading ? (
          <TableSkeleton />
        ) : professionals.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <p className="text-muted-foreground">
              Nenhum profissional encontrado para {monthLabel}.
            </p>
          </div>
        ) : (
          <>
            {/* Mobile (< sm): sempre cards */}
            <div className="sm:hidden space-y-3">
              {sorted.map((professional) => (
                <ProfessionalCard
                  key={professional.id}
                  professional={professional}
                  onClick={() => handleRowClick(professional)}
                />
              ))}
            </div>

            {/* sm+: respeita o viewMode */}
            <div className="hidden sm:block">
              {viewMode === 'cards' ? (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {sorted.map((professional) => (
                    <ProfessionalCard
                      key={professional.id}
                      professional={professional}
                      onClick={() => handleRowClick(professional)}
                    />
                  ))}
                </div>
              ) : (
                /* Tabela sortavel */
                <div className="rounded-lg border overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/50">
                          <th className="px-4 py-3 text-left">
                            <SortableHeader
                              label="Nome"
                              sortKey="name"
                              currentKey={sortKey as string}
                              currentDir={sortDir}
                              onSort={(k) => toggleSort(k as keyof ProfessionalReport)}
                            />
                          </th>
                          <th className="px-4 py-3 text-right">
                            <SortableHeader
                              label="Receita"
                              sortKey="revenue"
                              currentKey={sortKey as string}
                              currentDir={sortDir}
                              onSort={(k) => toggleSort(k as keyof ProfessionalReport)}
                            />
                          </th>
                          <th className="px-4 py-3 text-right">
                            <SortableHeader
                              label="Imposto"
                              sortKey="tax"
                              currentKey={sortKey as string}
                              currentDir={sortDir}
                              onSort={(k) => toggleSort(k as keyof ProfessionalReport)}
                            />
                          </th>
                          <th className="px-4 py-3 text-right">
                            <SortableHeader
                              label="Turnos"
                              sortKey="shifts"
                              currentKey={sortKey as string}
                              currentDir={sortDir}
                              onSort={(k) => toggleSort(k as keyof ProfessionalReport)}
                            />
                          </th>
                          <th className="px-4 py-3 text-right">
                            <SortableHeader
                              label="Liquido"
                              sortKey="netValue"
                              currentKey={sortKey as string}
                              currentDir={sortDir}
                              onSort={(k) => toggleSort(k as keyof ProfessionalReport)}
                            />
                          </th>
                          <th className="px-4 py-3 text-center">
                            <SortableHeader
                              label="Status"
                              sortKey="status"
                              currentKey={sortKey as string}
                              currentDir={sortDir}
                              onSort={(k) => toggleSort(k as keyof ProfessionalReport)}
                            />
                          </th>
                          <th className="px-4 py-3 w-8" aria-hidden />
                        </tr>
                      </thead>
                      <tbody>
                        {sorted.map((professional, idx) => (
                          <tr
                            key={professional.id}
                            onClick={() => handleRowClick(professional)}
                            className={cn(
                              'cursor-pointer transition-colors hover:bg-muted/50',
                              idx < sorted.length - 1 && 'border-b',
                            )}
                          >
                            <td className="px-4 py-3">
                              <div>
                                <p className="font-medium">{professional.name}</p>
                                <p className="text-xs text-muted-foreground">
                                  {professional.specialty}
                                </p>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-right tabular-nums">
                              {formatCurrency(professional.revenue)}
                            </td>
                            <td className="px-4 py-3 text-right tabular-nums">
                              {formatCurrency(professional.tax)}
                            </td>
                            <td className="px-4 py-3 text-right tabular-nums">
                              {professional.shifts}
                            </td>
                            <td className="px-4 py-3 text-right tabular-nums font-medium text-primary">
                              {formatCurrency(professional.netValue)}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <div className="inline-flex items-center gap-1.5">
                                {professional.status && <ReleaseStatusBadge status={professional.status} />}
                                {professional.isPaid && (
                                  <Badge className="bg-green-600 text-white hover:bg-green-600 text-[10px] px-1.5 h-5">
                                    Pago
                                  </Badge>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-muted-foreground">
                              <ChevronRight className="size-4" />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Dialog de confirmacao — Liberar Todos */}
      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleReleaseAll}
        title="Liberar todos os pendentes?"
        description={`Esta acao vai liberar ${pendingCount} relatorio${pendingCount !== 1 ? 's' : ''} pendente${pendingCount !== 1 ? 's' : ''} do mes de ${monthLabel} para revisao dos profissionais. Esta operacao nao pode ser desfeita em massa.`}
        confirmLabel="Liberar Todos"
        isLoading={releaseAll.isPending}
      />
    </AppLayout>
  );
}

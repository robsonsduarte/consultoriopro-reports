import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
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
  Save,
  History,
  Eye,
  Trash2,
  RotateCcw,
  Check,
} from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { StatusSummaryBar } from '@/components/domain/StatusSummaryBar';
import { ReleaseStatusBadge } from '@/components/domain/ReleaseStatusBadge';
import { SortableHeader } from '@/components/domain/SortableHeader';
import { ConfirmDialog } from '@/components/domain/ConfirmDialog';
import { StatCard } from '@/components/domain/StatCard';
import { SnapshotVersionBadge } from '@/components/domain/SnapshotVersionBadge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';
import { useSortableTable } from '@/hooks/useSortableTable';
import {
  useDashboardProfessionals,
  useReleaseAll,
  useSyncTrigger,
  useSyncStatus,
  useSyncProgress,
  useSnapshots,
  useSaveSnapshot,
  useRestoreSnapshot,
  useDeleteSnapshot,
} from '@/hooks/useApi';
import type { ProfessionalReport, ReportSnapshot } from '@/hooks/useApi';
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
  const [source, setSource] = useState<'live' | 'snapshot' | undefined>(undefined);
  const [snapshotsMenuOpen, setSnapshotsMenuOpen] = useState(false);
  const [restoreTarget, setRestoreTarget] = useState<ReportSnapshot | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ReportSnapshot | null>(null);
  const releaseAll = useReleaseAll();
  const syncTrigger = useSyncTrigger();
  const { data: syncStatus } = useSyncStatus();
  const { data: syncProgress } = useSyncProgress(syncJobId);

  // Snapshots do mes corrente
  const { data: snapshots = [] } = useSnapshots(currentMonth);
  const saveSnapshot = useSaveSnapshot();
  const restoreSnapshot = useRestoreSnapshot();
  const deleteSnapshot = useDeleteSnapshot();

  // Reset do source toggle ao trocar de mes
  useEffect(() => {
    setSource(undefined);
  }, [currentMonth]);

  // Invalida o dashboard e os reports quando o job de sync completa.
  useEffect(() => {
    if (syncJobId && syncProgress?.status === 'completed') {
      void qc.invalidateQueries({ queryKey: ['dashboard'] });
      void qc.invalidateQueries({ queryKey: ['report'] });
      setSyncJobId(null);
    }
  }, [syncProgress, qc, syncJobId]);

  const { data: dashboardResult, isLoading } = useDashboardProfessionals(currentMonth, source);
  const professionals = dashboardResult?.professionals ?? [];
  const meta = dashboardResult?.meta;
  const hasActiveSnapshot = snapshots.some((s) => s.isActive);

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
        shiftsValue: acc.shiftsValue + (p.shiftsValue ?? 0),
        netValue: acc.netValue + p.netValue,
      }),
      { revenue: 0, tax: 0, shifts: 0, shiftsValue: 0, netValue: 0 },
    );
  }, [professionals]);

  function handleRowClick(professional: ProfessionalReport) {
    const qs = new URLSearchParams({ month: currentMonth });
    const effectiveSource = source ?? (meta?.source === 'live' ? 'live' : undefined);
    if (effectiveSource) qs.set('source', effectiveSource);
    navigate(`/report/${professional.id}?${qs.toString()}`);
  }

  function handleSaveSnapshot() {
    saveSnapshot.mutate(currentMonth, {
      onSuccess: (snap) => {
        toast.success(`Versao ${snap.name} salva com sucesso`);
        setSource(undefined);
      },
      onError: (err) => {
        const msg = err instanceof Error ? err.message : 'Erro ao salvar versao';
        toast.error(msg);
      },
    });
  }

  function handleRestoreSnapshot() {
    if (!restoreTarget) return;
    restoreSnapshot.mutate(restoreTarget.id, {
      onSuccess: (snap) => {
        toast.success(`Versao ${snap.name} restaurada`);
        setRestoreTarget(null);
        setSnapshotsMenuOpen(false);
        setSource(undefined);
      },
      onError: (err) => {
        const msg = err instanceof Error ? err.message : 'Erro ao restaurar';
        toast.error(msg);
      },
    });
  }

  function handleDeleteSnapshot() {
    if (!deleteTarget) return;
    deleteSnapshot.mutate(
      { id: deleteTarget.id, month: currentMonth },
      {
        onSuccess: () => {
          toast.success(`Versao ${deleteTarget.name} removida`);
          setDeleteTarget(null);
        },
        onError: (err) => {
          const msg = err instanceof Error ? err.message : 'Erro ao remover';
          toast.error(msg);
        },
      },
    );
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
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold">Dashboard</h1>
            <SnapshotVersionBadge meta={meta} />
          </div>
          <p className="text-sm text-muted-foreground">{monthLabel}</p>
          {syncStatus?.lastSync && (
            <p className="text-xs text-muted-foreground">
              Dados atualizados em: {new Date(syncStatus.lastSync).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
            </p>
          )}
        </div>

        {/* Barra de versoes */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between rounded-lg border bg-muted/30 p-3">
          <div className="text-xs text-muted-foreground">
            {hasActiveSnapshot
              ? 'Versao salva exibindo dados congelados. Re-sincronizacoes nao afetam versoes salvas.'
              : 'Nenhuma versao salva. Os dados exibidos sao live (atualizados em cada sincronizacao).'}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {hasActiveSnapshot && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSource(source === 'live' ? undefined : 'live')}
              >
                <Eye className="size-4" />
                <span className="hidden sm:inline">
                  {source === 'live' ? 'Ver versao salva' : 'Ver live'}
                </span>
              </Button>
            )}
            {snapshots.length > 0 && (
              <div className="relative">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSnapshotsMenuOpen((v) => !v)}
                >
                  <History className="size-4" />
                  <span>Versoes ({snapshots.length})</span>
                </Button>
                {snapshotsMenuOpen && (
                  <div
                    className="absolute right-0 mt-1 w-80 rounded-md border bg-popover shadow-lg z-50"
                    onMouseLeave={() => setSnapshotsMenuOpen(false)}
                  >
                    <div className="p-2 text-xs font-medium text-muted-foreground border-b">
                      Historico de versoes
                    </div>
                    <ul className="max-h-96 overflow-y-auto">
                      {snapshots.map((snap) => (
                        <li
                          key={snap.id}
                          className="flex items-center justify-between gap-2 p-2 hover:bg-muted/50 border-b last:border-b-0"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium truncate flex items-center gap-1.5">
                              {snap.name}
                              {snap.isActive && (
                                <Check className="size-3.5 text-green-600" />
                              )}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(snap.createdAt).toLocaleString('pt-BR', {
                                day: '2-digit',
                                month: '2-digit',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </p>
                          </div>
                          {!snap.isActive && (
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                                title="Restaurar"
                                onClick={() => setRestoreTarget(snap)}
                              >
                                <RotateCcw className="size-3.5" />
                              </button>
                              <button
                                type="button"
                                className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                                title="Deletar"
                                onClick={() => setDeleteTarget(snap)}
                              >
                                <Trash2 className="size-3.5" />
                              </button>
                            </div>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
            <Button
              size="sm"
              onClick={handleSaveSnapshot}
              disabled={saveSnapshot.isPending || isLoading || professionals.length === 0}
            >
              <Save className="size-4" />
              <span>{saveSnapshot.isPending ? 'Salvando...' : 'Salvar versao'}</span>
            </Button>
          </div>
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
              subtitle={formatCurrency(totals.shiftsValue)}
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

      {/* Dialog de confirmacao — Restaurar versao */}
      <ConfirmDialog
        open={!!restoreTarget}
        onClose={() => setRestoreTarget(null)}
        onConfirm={handleRestoreSnapshot}
        title={`Restaurar ${restoreTarget?.name}?`}
        description="Todas as versoes posteriores serao deletadas permanentemente e esta versao se tornara a ativa."
        confirmLabel="Restaurar"
        isLoading={restoreSnapshot.isPending}
      />

      {/* Dialog de confirmacao — Deletar versao */}
      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteSnapshot}
        title={`Deletar ${deleteTarget?.name}?`}
        description="Esta versao sera permanentemente removida do historico. Esta acao nao pode ser desfeita."
        confirmLabel="Deletar"
        isLoading={deleteSnapshot.isPending}
      />
    </AppLayout>
  );
}

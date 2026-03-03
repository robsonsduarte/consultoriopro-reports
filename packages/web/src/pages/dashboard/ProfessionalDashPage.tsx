import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  CheckCircle2,
  MessageSquare,
  FileText,
  DollarSign,
  Receipt,
  Clock,
  Banknote,
  ChevronRight,
} from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { StatCard } from '@/components/domain/StatCard';
import { ReleaseStatusBadge } from '@/components/domain/ReleaseStatusBadge';
import { ConfirmDialog } from '@/components/domain/ConfirmDialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrency, formatMonth } from '@/lib/format';
import { useUiStore } from '@/stores/uiStore';
import { useAuthStore } from '@/stores/authStore';
import { useMyReleases, useApproveRelease } from '@/hooks/useApi';
import type { MyRelease } from '@/hooks/useApi';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Banner de acao pendente
// ---------------------------------------------------------------------------

interface PendingActionBannerProps {
  release: MyRelease;
  onApprove: () => void;
  onContest: () => void;
}

function PendingActionBanner({
  release,
  onApprove,
  onContest,
}: PendingActionBannerProps) {
  return (
    <div className="rounded-lg border border-yellow-300 bg-yellow-50 p-4 dark:border-yellow-800 dark:bg-yellow-900/20">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <AlertCircle className="size-5 text-yellow-600 dark:text-yellow-400 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-yellow-900 dark:text-yellow-200">
              Relatorio de {formatMonth(release.month)} aguarda sua revisao
            </p>
            <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-0.5">
              Verifique os dados e aprove ou conteste o relatorio.
            </p>
          </div>
        </div>

        <div className="flex gap-2 sm:shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={onContest}
            className="border-yellow-400 text-yellow-800 hover:bg-yellow-100 dark:border-yellow-700 dark:text-yellow-300 dark:hover:bg-yellow-900/40"
          >
            <MessageSquare className="size-4" />
            Contestar
          </Button>
          <Button
            size="sm"
            onClick={onApprove}
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            <CheckCircle2 className="size-4" />
            Aprovar
          </Button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Card de historico mensal
// ---------------------------------------------------------------------------

interface HistoryItemCardProps {
  release: MyRelease;
  onClick: () => void;
}

function HistoryItemCard({ release, onClick }: HistoryItemCardProps) {
  return (
    <Card className="gap-0 py-0 overflow-hidden">
      <CardContent className="p-0">
        <div className="flex items-center gap-4 p-4">
          {/* Mes */}
          <div className="min-w-[7rem]">
            <p className="font-medium text-sm">{formatMonth(release.month)}</p>
          </div>

          {/* Status */}
          <div className="flex-1">
            <ReleaseStatusBadge status={release.status} />
          </div>

          {/* Valores — ocultos em mobile pequeno */}
          <div className="hidden sm:flex items-center gap-6 text-sm">
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Receita</p>
              <p className="tabular-nums">{formatCurrency(release.revenue)}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Liquido</p>
              <p className="tabular-nums font-medium text-primary">
                {formatCurrency(release.netValue)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Turnos</p>
              <p className="tabular-nums">{release.shifts}</p>
            </div>
          </div>

          {/* Botao ver relatorio */}
          <Button
            variant="ghost"
            size="sm"
            onClick={onClick}
            className="shrink-0 text-muted-foreground hover:text-foreground"
          >
            <FileText className="size-4" />
            <span className="hidden sm:inline">Ver Relatorio</span>
            <ChevronRight className="size-4 sm:hidden" />
          </Button>
        </div>

        {/* Valores expandidos em mobile */}
        <div className="sm:hidden grid grid-cols-3 gap-px border-t bg-muted/30 text-xs">
          {[
            { label: 'Receita', value: formatCurrency(release.revenue) },
            { label: 'Liquido', value: formatCurrency(release.netValue) },
            { label: 'Turnos', value: String(release.shifts) },
          ].map(({ label, value }) => (
            <div key={label} className="bg-card p-2 text-center">
              <p className="text-muted-foreground">{label}</p>
              <p className="font-medium">{value}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Page principal
// ---------------------------------------------------------------------------

export function ProfessionalDashPage() {
  const navigate = useNavigate();
  const { currentMonth } = useUiStore();
  const { user } = useAuthStore();

  const [approveOpen, setApproveOpen] = useState(false);
  const [contestOpen, setContestOpen] = useState(false);

  // Dados reais via API — so meses com release
  const { data: history = [], isLoading } = useMyReleases();

  const approveRelease = useApproveRelease();

  // Mes mais recente liberado como resumo
  const currentReport = history.find((h) => h.month === currentMonth) ?? history[0];

  // Verifica se ha algum mes pendente de acao
  const pendingReport = history.find((h) => h.status === 'pending');

  const monthLabel = currentReport ? formatMonth(currentReport.month) : formatMonth(currentMonth);

  function handleViewReport(month: string) {
    navigate(`/report/${user?.apiProfessionalId ?? 0}?month=${month}`);
  }

  function handleApprove() {
    if (!pendingReport) return;
    approveRelease.mutate(
      { releaseId: pendingReport.releaseId, professionalId: user?.apiProfessionalId ?? 0, month: pendingReport.month },
      { onSuccess: () => setApproveOpen(false) },
    );
  }

  function handleContestNavigate() {
    setContestOpen(false);
    if (pendingReport) {
      navigate(
        `/report/${user?.apiProfessionalId ?? 0}?month=${pendingReport.month}&tab=contestacao`,
      );
    }
  }

  const stats = currentReport
    ? [
        {
          title: 'Receita',
          value: formatCurrency(currentReport.revenue),
          icon: DollarSign,
          trend: 'up' as const,
        },
        {
          title: 'Imposto',
          value: formatCurrency(currentReport.tax),
          icon: Receipt,
        },
        {
          title: 'Turnos',
          value: String(currentReport.shifts),
          icon: Clock,
        },
        {
          title: 'Liquido',
          value: formatCurrency(currentReport.netValue),
          icon: Banknote,
          trend: currentReport.netValue >= 0 ? 'up' as const : 'down' as const,
        },
      ]
    : [];

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Acao pendente — SEMPRE no topo */}
        {pendingReport && (
          <PendingActionBanner
            release={pendingReport}
            onApprove={() => setApproveOpen(true)}
            onContest={handleContestNavigate}
          />
        )}

        {/* Cabecalho */}
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold">Meu Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Bem-vindo, {user?.name?.split(' ')[0] ?? 'Profissional'}
          </p>
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-24 rounded-lg" />
              ))}
            </div>
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-16 rounded-lg" />
            ))}
          </div>
        )}

        {/* Cards resumo do mes mais recente */}
        {!isLoading && (
          <section>
            <h2 className={cn('text-sm font-medium text-muted-foreground mb-3')}>
              {currentReport ? `Resumo de ${monthLabel}` : 'Resumo'}
            </h2>

            {currentReport ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {stats.map((stat) => (
                  <StatCard
                    key={stat.title}
                    title={stat.title}
                    value={stat.value}
                    icon={stat.icon}
                    trend={stat.trend}
                  />
                ))}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed p-8 text-center">
                <p className="text-sm text-muted-foreground">
                  Nenhum relatorio liberado ainda.
                </p>
              </div>
            )}
          </section>
        )}

        {/* Historico de meses liberados */}
        {!isLoading && (
          <section>
            <h2 className="text-sm font-medium text-muted-foreground mb-3">
              Historico
            </h2>

            {history.length === 0 ? (
              <div className="rounded-lg border border-dashed p-8 text-center">
                <p className="text-sm text-muted-foreground">
                  Nenhum relatorio liberado ainda.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {history.map((item) => (
                  <HistoryItemCard
                    key={item.month}
                    release={item}
                    onClick={() => handleViewReport(item.month)}
                  />
                ))}
              </div>
            )}
          </section>
        )}
      </div>

      {/* Dialog confirmar aprovacao */}
      <ConfirmDialog
        open={approveOpen}
        onClose={() => setApproveOpen(false)}
        onConfirm={handleApprove}
        title="Aprovar relatorio?"
        description={`Ao aprovar, voce confirma que os dados do relatorio de ${pendingReport ? formatMonth(pendingReport.month) : monthLabel} estao corretos.`}
        confirmLabel="Aprovar"
        isLoading={approveRelease.isPending}
      />

      {/* Dialog confirmar contestacao */}
      <ConfirmDialog
        open={contestOpen}
        onClose={() => setContestOpen(false)}
        onConfirm={handleContestNavigate}
        title="Contestar relatorio?"
        description={`Voce sera redirecionado para o relatorio de ${pendingReport ? formatMonth(pendingReport.month) : monthLabel} onde podera explicar a contestacao.`}
        confirmLabel="Ir para contestacao"
        variant="destructive"
      />
    </AppLayout>
  );
}

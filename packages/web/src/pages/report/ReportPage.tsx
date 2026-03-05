import { useState, useMemo, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import {
  FileText,
  Send,
  Trash2,
  Plus,
  Check,
  X,
  Lock,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Loader2,
  Banknote,
  MessageSquare,
  DollarSign,
  Receipt,
  Clock,
  RefreshCw,
} from 'lucide-react';
import type { ReleaseStatus, ShiftPeriod, ShiftModality } from '@cpro/shared';
import { AppLayout } from '@/components/layout/AppLayout';
import { ProfessionalSelect } from '@/components/domain/ProfessionalSelect';
import { ReleaseStatusBadge } from '@/components/domain/ReleaseStatusBadge';
import { ShiftFormModal } from '@/components/domain/ShiftFormModal';
import { StatCard } from '@/components/domain/StatCard';
import { ConfirmDialog } from '@/components/domain/ConfirmDialog';
import { SortableHeader } from '@/components/domain/SortableHeader';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useSortableTable } from '@/hooks/useSortableTable';
import { useAuthStore } from '@/stores/authStore';
import { useUiStore } from '@/stores/uiStore';
import {
  useReport,
  useCreateShift,
  useUpdateShift,
  useDeleteShift,
  useReleaseReport,
  useRevokeRelease,
  useApproveRelease,
  useContestRelease,
  useResolveRelease,
  useMarkPaid,
  useSendThreadMessage,
  useToggleAppointmentPaid,
  useExcludeAppointment,
  useMarkNotificationsRead,
  useSyncTrigger,
} from '@/hooks/useApi';
import type { Appointment, OperatorSummary, Shift, ThreadMessage } from '@/hooks/useApi';
import {
  formatCurrency,
  formatDate,
  formatDateTime,
  formatDayOfWeek,
  formatPeriod,
  formatModality,
  formatMonth,
} from '@/lib/format';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Release action bar
// ---------------------------------------------------------------------------

interface ReleaseBarProps {
  status: ReleaseStatus | null;
  isPaid: boolean;
  isAdmin: boolean;
  onAction: (action: string) => void;
  loading: boolean;
}

function ReleaseBar({ status, isPaid, isAdmin, onAction, loading }: ReleaseBarProps) {
  if (isAdmin) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <ReleaseStatusBadge status={status ?? 'pending'} />
        {isPaid && (
          <Badge className="bg-green-600 text-white hover:bg-green-600">
            <Banknote className="mr-1 size-3" />
            Pago
          </Badge>
        )}
        {(!status || status === 'pending') && (
          <>
            {!status && (
              <Button size="sm" onClick={() => onAction('release')} disabled={loading}>
                {loading && <Loader2 className="size-3.5 animate-spin" />}
                <CheckCircle2 className="size-3.5" />
                Liberar
              </Button>
            )}
            {status === 'pending' && (
              <Button size="sm" variant="outline" onClick={() => onAction('revoke')} disabled={loading}>
                <RotateCcw className="size-3.5" />
                Revogar
              </Button>
            )}
          </>
        )}
        {status === 'approved' && (
          <>
            {!isPaid && (
              <Button size="sm" onClick={() => onAction('mark_paid')} disabled={loading}>
                <Banknote className="size-3.5" />
                Marcar Pago
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={() => onAction('revoke')} disabled={loading}>
              <RotateCcw className="size-3.5" />
              Revogar
            </Button>
          </>
        )}
        {(status === 'contested' || status === 'in_review') && (
          <Button size="sm" onClick={() => onAction('resolve')} disabled={loading}>
            <Check className="size-3.5" />
            Resolver
          </Button>
        )}
        {status === 'resolved' && (
          <>
            {!isPaid && (
              <Button size="sm" onClick={() => onAction('mark_paid')} disabled={loading}>
                <Banknote className="size-3.5" />
                Marcar Pago
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={() => onAction('revoke')} disabled={loading}>
              <RotateCcw className="size-3.5" />
              Revogar
            </Button>
          </>
        )}
      </div>
    );
  }

  // Profissional view
  if (!status) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-dashed p-3 text-muted-foreground">
        <Lock className="size-4" />
        <span className="text-sm">Relatorio nao liberado ainda.</span>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <ReleaseStatusBadge status={status} />
      {isPaid && (
        <Badge className="bg-green-600 text-white hover:bg-green-600">
          <Banknote className="mr-1 size-3" />
          Pago
        </Badge>
      )}
      {status === 'pending' && (
        <>
          <Button size="sm" onClick={() => onAction('approve')} disabled={loading}>
            <CheckCircle2 className="size-3.5" />
            Aprovar
          </Button>
          <Button size="sm" variant="destructive" onClick={() => onAction('contest')} disabled={loading}>
            <XCircle className="size-3.5" />
            Contestar
          </Button>
        </>
      )}
      {status === 'resolved' && (
        <>
          <Button size="sm" onClick={() => onAction('approve')} disabled={loading}>
            <CheckCircle2 className="size-3.5" />
            Aprovar
          </Button>
          <Button size="sm" variant="destructive" onClick={() => onAction('contest')} disabled={loading}>
            <XCircle className="size-3.5" />
            Contestar
          </Button>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab 1: Atendimentos
// ---------------------------------------------------------------------------

function AppointmentsTab({
  isAdmin,
  appointments,
  professionalId,
  month,
}: {
  isAdmin: boolean;
  appointments: Appointment[];
  professionalId: number;
  month: string;
}) {
  const togglePaid = useToggleAppointmentPaid();
  const excludeAppt = useExcludeAppointment();
  const [excludeTarget, setExcludeTarget] = useState<Appointment | null>(null);

  const { sorted, sortKey, sortDir, toggleSort } = useSortableTable(
    appointments,
    'date' as keyof Appointment,
  );

  const total = useMemo(() => sorted.reduce((s, a) => s + a.value, 0), [sorted]);

  function handleConfirmExclude() {
    if (!excludeTarget) return;
    excludeAppt.mutate(
      { externalAppointmentId: excludeTarget.id, professionalId, month, isExcluded: true },
      { onSuccess: () => setExcludeTarget(null) },
    );
  }

  return (
    <div className="space-y-3">
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>
                <SortableHeader label="Data" sortKey="date" currentKey={String(sortKey)} currentDir={sortDir} onSort={(k) => toggleSort(k as keyof Appointment)} />
              </TableHead>
              <TableHead>
                <SortableHeader label="Hora" sortKey="time" currentKey={String(sortKey)} currentDir={sortDir} onSort={(k) => toggleSort(k as keyof Appointment)} />
              </TableHead>
              <TableHead className="hidden sm:table-cell">Guia</TableHead>
              <TableHead>
                <SortableHeader label="Paciente" sortKey="patientName" currentKey={String(sortKey)} currentDir={sortDir} onSort={(k) => toggleSort(k as keyof Appointment)} />
              </TableHead>
              <TableHead className="hidden sm:table-cell">Operador</TableHead>
              <TableHead className="text-right">
                <SortableHeader label="Valor" sortKey="value" currentKey={String(sortKey)} currentDir={sortDir} onSort={(k) => toggleSort(k as keyof Appointment)} className="justify-end" />
              </TableHead>
              {isAdmin && <TableHead className="w-16 text-center">Pago</TableHead>}
              {isAdmin && <TableHead className="w-12" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((a) => (
              <TableRow key={a.id}>
                <TableCell>{formatDate(a.date)}</TableCell>
                <TableCell className="text-muted-foreground tabular-nums">{a.time ? a.time.slice(0, 5) : '—'}</TableCell>
                <TableCell className="hidden sm:table-cell text-muted-foreground tabular-nums">{a.guideNumber ?? '—'}</TableCell>
                <TableCell className="font-medium">{a.patientName}</TableCell>
                <TableCell className="hidden sm:table-cell text-muted-foreground">
                  {a.operatorName || '—'}
                </TableCell>
                <TableCell className="text-right font-mono">{formatCurrency(a.value)}</TableCell>
                {isAdmin && (
                  <TableCell className="text-center">
                    <button
                      type="button"
                      className="inline-flex items-center justify-center"
                      onClick={() => togglePaid.mutate({ externalAppointmentId: a.id, professionalId, month, isPaid: !a.isPaid })}
                    >
                      {a.isPaid ? (
                        <Check className="size-4 text-green-600 dark:text-green-400" />
                      ) : (
                        <X className="size-4 text-muted-foreground/40" />
                      )}
                    </button>
                  </TableCell>
                )}
                {isAdmin && (
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7 text-muted-foreground hover:text-destructive"
                      onClick={() => setExcludeTarget(a)}
                      disabled={excludeAppt.isPending}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <p className="text-sm text-muted-foreground">
        {sorted.length} atendimento{sorted.length !== 1 ? 's' : ''} &middot; Total: {formatCurrency(total)}
      </p>

      <ConfirmDialog
        open={!!excludeTarget}
        onClose={() => setExcludeTarget(null)}
        onConfirm={handleConfirmExclude}
        title="Excluir Atendimento"
        description={
          excludeTarget
            ? `Excluir atendimento de ${excludeTarget.patientName} em ${formatDate(excludeTarget.date)} (${formatCurrency(excludeTarget.value)})? Esta acao cancela o atendimento no sistema principal e nao pode ser desfeita.`
            : ''
        }
        confirmLabel="Excluir"
        variant="destructive"
        isLoading={excludeAppt.isPending}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab 2: Operadores
// ---------------------------------------------------------------------------

function OperatorsTab({ operators }: { operators: OperatorSummary[] }) {
  const { sorted, sortKey, sortDir, toggleSort } = useSortableTable(
    operators,
    'name' as keyof OperatorSummary,
  );

  const totalValue = useMemo(() => sorted.reduce((s, o) => s + o.totalValue, 0), [sorted]);

  return (
    <div className="space-y-3">
      {sorted.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12 text-center">
          <p className="text-sm text-muted-foreground">Nenhum operador neste periodo.</p>
        </div>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  <SortableHeader label="Nome" sortKey="name" currentKey={String(sortKey)} currentDir={sortDir} onSort={(k) => toggleSort(k as keyof OperatorSummary)} />
                </TableHead>
                <TableHead className="text-right">
                  <SortableHeader label="Atendimentos" sortKey="appointmentCount" currentKey={String(sortKey)} currentDir={sortDir} onSort={(k) => toggleSort(k as keyof OperatorSummary)} className="justify-end" />
                </TableHead>
                <TableHead className="text-right">
                  <SortableHeader label="Total (R$)" sortKey="totalValue" currentKey={String(sortKey)} currentDir={sortDir} onSort={(k) => toggleSort(k as keyof OperatorSummary)} className="justify-end" />
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((o) => (
                <TableRow key={o.name}>
                  <TableCell className="font-medium">{o.name}</TableCell>
                  <TableCell className="text-right">{o.appointmentCount}</TableCell>
                  <TableCell className="text-right font-mono">{formatCurrency(o.totalValue)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      {sorted.length > 0 && (
        <p className="text-sm text-muted-foreground">
          {sorted.length} operador{sorted.length !== 1 ? 'es' : ''} &middot; Total: {formatCurrency(totalValue)}
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab 3: Turnos (inline edit)
// ---------------------------------------------------------------------------

const DAY_OPTIONS = [
  { value: '1', label: 'Segunda' },
  { value: '2', label: 'Terca' },
  { value: '3', label: 'Quarta' },
  { value: '4', label: 'Quinta' },
  { value: '5', label: 'Sexta' },
  { value: '6', label: 'Sabado' },
];

const PERIOD_OPTIONS: { value: ShiftPeriod; label: string }[] = [
  { value: 'morning', label: 'Manha' },
  { value: 'afternoon', label: 'Tarde' },
  { value: 'evening', label: 'Noite' },
];

const MODALITY_OPTIONS: { value: ShiftModality; label: string }[] = [
  { value: 'presencial', label: 'Presencial' },
  { value: 'online', label: 'Online' },
];

interface ShiftRowProps {
  shift: Shift;
  isAdmin: boolean;
  editingId: number | null;
  onStartEdit: (id: number) => void;
  onCancelEdit: () => void;
  onSaveEdit: (id: number, data: { dayOfWeek: number; period: ShiftPeriod; modality: ShiftModality; shiftValue: number }) => void;
  onDelete: (shift: Shift) => void;
}

function ShiftRow({ shift, isAdmin, editingId, onStartEdit, onCancelEdit, onSaveEdit, onDelete }: ShiftRowProps) {
  const isEditing = editingId === shift.id;
  const [day, setDay] = useState(String(shift.dayOfWeek));
  const [period, setPeriod] = useState<ShiftPeriod>(shift.period as ShiftPeriod);
  const [modality, setModality] = useState<ShiftModality>(shift.modality as ShiftModality);
  const [value, setValue] = useState(shift.shiftValue);

  if (isEditing && isAdmin) {
    return (
      <TableRow>
        <TableCell>
          <Select value={day} onValueChange={setDay}>
            <SelectTrigger className="h-8 w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DAY_OPTIONS.map((d) => (
                <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </TableCell>
        <TableCell>
          <Select value={period} onValueChange={(v) => setPeriod(v as ShiftPeriod)}>
            <SelectTrigger className="h-8 w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PERIOD_OPTIONS.map((p) => (
                <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </TableCell>
        <TableCell>
          <Select value={modality} onValueChange={(v) => setModality(v as ShiftModality)}>
            <SelectTrigger className="h-8 w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MODALITY_OPTIONS.map((m) => (
                <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </TableCell>
        <TableCell>
          <Input
            type="number"
            min={0}
            step={0.01}
            value={value}
            onChange={(e) => setValue(Number(e.target.value))}
            className="h-8 w-28 text-right font-mono"
          />
        </TableCell>
        <TableCell>
          <span className="text-xs text-muted-foreground capitalize">
            {shift.origin === 'inferred' ? 'Inferido' : 'Manual'}
          </span>
        </TableCell>
        <TableCell>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="size-7 text-green-600 hover:text-green-700"
              onClick={() => onSaveEdit(shift.id, { dayOfWeek: Number(day), period, modality, shiftValue: value })}
            >
              <Check className="size-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-7 text-muted-foreground hover:text-foreground"
              onClick={onCancelEdit}
            >
              <X className="size-3.5" />
            </Button>
          </div>
        </TableCell>
      </TableRow>
    );
  }

  return (
    <TableRow
      className={cn(isAdmin && 'cursor-pointer')}
      onClick={() => isAdmin && onStartEdit(shift.id)}
    >
      <TableCell className="font-medium">{formatDayOfWeek(shift.dayOfWeek)}</TableCell>
      <TableCell>{formatPeriod(shift.period)}</TableCell>
      <TableCell>
        <Badge variant={shift.modality === 'presencial' ? 'default' : 'secondary'}>
          {formatModality(shift.modality)}
        </Badge>
      </TableCell>
      <TableCell className="text-right font-mono">{formatCurrency(shift.shiftValue)}</TableCell>
      <TableCell>
        <span className="text-xs text-muted-foreground capitalize">
          {shift.origin === 'inferred' ? 'Inferido' : 'Manual'}
        </span>
      </TableCell>
      <TableCell>
        {isAdmin && (
          <Button
            variant="ghost"
            size="icon"
            className="size-7 text-muted-foreground hover:text-destructive"
            onClick={(e) => { e.stopPropagation(); onDelete(shift); }}
          >
            <Trash2 className="size-3.5" />
          </Button>
        )}
      </TableCell>
    </TableRow>
  );
}

function ShiftsTab({
  professionalId,
  isAdmin,
  shifts,
  month,
}: {
  professionalId: number;
  isAdmin: boolean;
  shifts: Shift[];
  month: string;
}) {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Shift | null>(null);

  const updateShift = useUpdateShift();
  const deleteShift = useDeleteShift();
  const createShift = useCreateShift();

  const { sorted, sortKey, sortDir, toggleSort } = useSortableTable(shifts, 'dayOfWeek' as keyof Shift);

  const totalValue = useMemo(() => sorted.reduce((s, sh) => s + sh.shiftValue, 0), [sorted]);

  function handleSaveEdit(id: number, data: { dayOfWeek: number; period: ShiftPeriod; modality: ShiftModality; shiftValue: number }) {
    updateShift.mutate(
      { id, professionalId, month, ...data },
      { onSuccess: () => setEditingId(null) },
    );
  }

  function handleDelete() {
    if (!deleteTarget) return;
    deleteShift.mutate(
      { id: deleteTarget.id, professionalId, month },
      { onSuccess: () => setDeleteTarget(null) },
    );
  }

  function handleCreate(formData: {
    dayOfWeek: number;
    period: ShiftPeriod;
    modality: ShiftModality;
    shiftValue: number;
  }) {
    createShift.mutate(
      { professionalId, month, ...formData },
      { onSuccess: () => setFormOpen(false) },
    );
  }

  return (
    <div className="space-y-3">
      {isAdmin && (
        <div className="flex gap-2">
          <Button size="sm" onClick={() => setFormOpen(true)}>
            <Plus className="size-3.5" />
            Adicionar Turno
          </Button>
        </div>
      )}

      {sorted.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12 text-center">
          <p className="text-sm text-muted-foreground">Nenhum turno neste periodo.</p>
        </div>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  <SortableHeader label="Dia" sortKey="dayOfWeek" currentKey={String(sortKey)} currentDir={sortDir} onSort={(k) => toggleSort(k as keyof Shift)} />
                </TableHead>
                <TableHead>
                  <SortableHeader label="Periodo" sortKey="period" currentKey={String(sortKey)} currentDir={sortDir} onSort={(k) => toggleSort(k as keyof Shift)} />
                </TableHead>
                <TableHead>
                  <SortableHeader label="Tipo" sortKey="modality" currentKey={String(sortKey)} currentDir={sortDir} onSort={(k) => toggleSort(k as keyof Shift)} />
                </TableHead>
                <TableHead className="text-right">
                  <SortableHeader label="Valor" sortKey="shiftValue" currentKey={String(sortKey)} currentDir={sortDir} onSort={(k) => toggleSort(k as keyof Shift)} className="justify-end" />
                </TableHead>
                <TableHead>Origem</TableHead>
                <TableHead className="w-20" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((shift) => (
                <ShiftRow
                  key={shift.id}
                  shift={shift}
                  isAdmin={isAdmin}
                  editingId={editingId}
                  onStartEdit={setEditingId}
                  onCancelEdit={() => setEditingId(null)}
                  onSaveEdit={handleSaveEdit}
                  onDelete={setDeleteTarget}
                />
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {sorted.length > 0 && (
        <p className="text-sm text-muted-foreground">
          {sorted.length} turno{sorted.length !== 1 ? 's' : ''} &middot; Total: {formatCurrency(totalValue)}
        </p>
      )}

      <ShiftFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSubmit={handleCreate}
        isLoading={createShift.isPending}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Excluir Turno"
        description={
          deleteTarget
            ? `Excluir turno de ${formatDayOfWeek(deleteTarget.dayOfWeek)} (${formatPeriod(deleteTarget.period)}) — ${formatCurrency(deleteTarget.shiftValue)}?`
            : ''
        }
        confirmLabel="Excluir"
        variant="destructive"
        isLoading={deleteShift.isPending}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab 4: Contestacao (thread de mensagens)
// ---------------------------------------------------------------------------

function ThreadMessageBubble({ msg, isCurrentUser }: { msg: ThreadMessage; isCurrentUser: boolean }) {
  return (
    <div className={cn('flex flex-col gap-1', isCurrentUser ? 'items-end' : 'items-start')}>
      <div
        className={cn(
          'max-w-[85%] rounded-xl px-4 py-2.5 text-sm',
          isCurrentUser
            ? 'bg-primary text-primary-foreground'
            : 'bg-muted',
        )}
      >
        <p className="whitespace-pre-wrap">{msg.message}</p>
      </div>
      <div className="flex items-center gap-2 px-1">
        <span className="text-[11px] font-medium text-muted-foreground">{msg.senderName}</span>
        <span className="text-[11px] text-muted-foreground/60">{formatDateTime(msg.createdAt)}</span>
      </div>
    </div>
  );
}

function ContestationTab({
  isAdmin,
  thread,
  releaseId,
  releaseStatus,
  professionalId,
  month,
}: {
  isAdmin: boolean;
  thread: ThreadMessage[];
  releaseId: number | null;
  releaseStatus: ReleaseStatus | null;
  professionalId: number;
  month: string;
}) {
  const [newMessage, setNewMessage] = useState('');
  const [resolveOpen, setResolveOpen] = useState(false);

  const sendMessage = useSendThreadMessage();
  const resolveRelease = useResolveRelease();

  const currentRole = isAdmin ? 'admin' : 'user';

  function handleSend() {
    if (!newMessage.trim() || !releaseId) return;
    sendMessage.mutate(
      { releaseId, professionalId, month, message: newMessage },
      { onSuccess: () => setNewMessage('') },
    );
  }

  function handleResolve() {
    if (!releaseId) return;
    resolveRelease.mutate(
      { releaseId, professionalId, month },
      { onSuccess: () => setResolveOpen(false) },
    );
  }

  return (
    <div className="space-y-4">
      {thread.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12 text-center">
          <MessageSquare className="mb-3 size-10 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">Nenhuma contestacao registrada.</p>
        </div>
      ) : (
        <>
          {/* Thread */}
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-col gap-4">
                {thread.map((msg) => (
                  <ThreadMessageBubble
                    key={msg.id}
                    msg={msg}
                    isCurrentUser={msg.senderRole === currentRole}
                  />
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Reply area */}
          <div className="flex flex-col gap-2">
            <Textarea
              placeholder="Digite sua resposta..."
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              rows={3}
              className="resize-none"
            />
            <div className="flex flex-wrap items-center gap-2">
              <Button
                onClick={handleSend}
                disabled={sendMessage.isPending || !newMessage.trim()}
                size="sm"
              >
                {sendMessage.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />}
                Enviar
              </Button>
              {isAdmin && (releaseStatus === 'contested' || releaseStatus === 'in_review') && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setResolveOpen(true)}
                >
                  <Check className="size-3.5" />
                  Resolver Contestacao
                </Button>
              )}
            </div>
          </div>

          <ConfirmDialog
            open={resolveOpen}
            onClose={() => setResolveOpen(false)}
            onConfirm={handleResolve}
            title="Resolver Contestacao"
            description="Ao resolver, o profissional sera notificado e o relatorio voltara ao status anterior. Deseja continuar?"
            confirmLabel="Resolver"
            isLoading={resolveRelease.isPending}
          />
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page principal
// ---------------------------------------------------------------------------

export function ReportPage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const monthParam = searchParams.get('month');
  const currentMonth = useUiStore((s) => s.currentMonth);
  const setCurrentMonth = useUiStore((s) => s.setCurrentMonth);

  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === 'super_admin' || user?.role === 'admin';
  const syncTrigger = useSyncTrigger();

  // Set month from query param
  useMemo(() => {
    if (monthParam && monthParam !== currentMonth) {
      setCurrentMonth(monthParam);
    }
  }, [monthParam]); // eslint-disable-line react-hooks/exhaustive-deps

  const [selectedId, setSelectedId] = useState<string>(
    id ?? (isAdmin ? '' : String(user?.apiProfessionalId ?? '')),
  );

  // Sincronizar selectedId quando o param :id da URL muda (ex: via notificacao)
  useEffect(() => {
    if (id && id !== selectedId) {
      setSelectedId(id);
    }
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Dados reais via API
  const { data: report, isLoading: reportLoading } = useReport(
    Number(selectedId),
    currentMonth,
  );

  const professional = report?.professional ?? null;
  const releaseStatus: ReleaseStatus | null = report?.release?.status ?? null;

  // Release mutations
  const releaseReport = useReleaseReport();
  const revokeRelease = useRevokeRelease();
  const approveRelease = useApproveRelease();
  const contestRelease = useContestRelease();
  const resolveRelease = useResolveRelease();
  const markPaid = useMarkPaid();

  const [contestOpen, setContestOpen] = useState(false);
  const [contestNote, setContestNote] = useState('');

  // Tab ativa (query param ?tab=contestacao)
  const tabParam = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState(
    tabParam === 'contestacao' ? 'contestation' : (tabParam ?? 'appointments'),
  );

  // Sincronizar activeTab quando query param ?tab muda
  useEffect(() => {
    if (tabParam) {
      const mapped = tabParam === 'contestacao' ? 'contestation' : tabParam;
      setActiveTab(mapped);
    }
  }, [tabParam]);

  // Auto-marcar notificacoes como lidas ao abrir tab contestacao
  const markRead = useMarkNotificationsRead();
  useEffect(() => {
    if (activeTab === 'contestation' && report?.release?.id) {
      markRead.mutate(report.release.id);
    }
  }, [activeTab, report?.release?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const releaseLoading = releaseReport.isPending || revokeRelease.isPending || approveRelease.isPending || resolveRelease.isPending || markPaid.isPending;

  function handleReleaseAction(action: string) {
    if (action === 'contest') {
      setContestOpen(true);
      return;
    }
    const profId = Number(selectedId);
    const releaseId = report?.release?.id;

    if (action === 'release') {
      releaseReport.mutate({ professionalId: profId, month: currentMonth });
    } else if (action === 'revoke' && releaseId) {
      revokeRelease.mutate({ releaseId, professionalId: profId, month: currentMonth });
    } else if (action === 'approve' && releaseId) {
      approveRelease.mutate({ releaseId, professionalId: profId, month: currentMonth });
    } else if (action === 'resolve' && releaseId) {
      resolveRelease.mutate({ releaseId, professionalId: profId, month: currentMonth });
    } else if (action === 'mark_paid' && releaseId) {
      markPaid.mutate({ releaseId, professionalId: profId, month: currentMonth });
    }
  }

  function handleContest() {
    if (!contestNote.trim() || !report?.release?.id) return;
    contestRelease.mutate(
      { releaseId: report.release.id, professionalId: Number(selectedId), month: currentMonth, message: contestNote },
      { onSuccess: () => { setContestOpen(false); setContestNote(''); } },
    );
  }

  // Block view for professional when not released
  const isBlocked = !isAdmin && !releaseStatus;

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <FileText className="size-5" />
            </div>
            <div>
              <h1 className="text-xl font-semibold">Relatorio</h1>
              <p className="text-sm text-muted-foreground">
                {professional?.name ?? 'Profissional'} &middot; {formatMonth(currentMonth)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isAdmin && (
              <ProfessionalSelect
                value={selectedId}
                onChange={setSelectedId}
                className="w-full sm:w-72"
              />
            )}
            {isAdmin && selectedId && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  syncTrigger.mutate(
                    { month: currentMonth, professionalId: Number(selectedId) },
                    { onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['report', Number(selectedId), currentMonth] }) },
                  );
                }}
                disabled={syncTrigger.isPending}
              >
                <RefreshCw className={cn('size-4', syncTrigger.isPending && 'animate-spin')} />
                Atualizar Dados
              </Button>
            )}
          </div>
        </div>

        {/* Release bar */}
        <ReleaseBar
          status={releaseStatus}
          isPaid={report?.release?.isPaid ?? false}
          isAdmin={isAdmin}
          onAction={handleReleaseAction}
          loading={releaseLoading}
        />

        {/* Summary cards */}
        {!reportLoading && !isBlocked && report && (() => {
          const revenue = report.summary.revenue;
          const tax = report.summary.tax;
          const shiftsValue = report.summary.shiftsValue;
          const shiftsCount = (report.shifts ?? []).length;
          const netValue = report.summary.netValue;
          return (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatCard
                title="Receita"
                value={formatCurrency(revenue)}
                icon={DollarSign}
                trend="up"
              />
              <StatCard
                title="Impostos"
                value={formatCurrency(tax)}
                icon={Receipt}
              />
              <StatCard
                title="Total Turnos"
                value={String(shiftsCount)}
                icon={Clock}
                subtitle={shiftsCount > 0 ? formatCurrency(shiftsValue) : undefined}
              />
              <StatCard
                title="Liquido"
                value={formatCurrency(netValue)}
                icon={Banknote}
                trend={netValue >= 0 ? 'up' : 'down'}
              />
            </div>
          );
        })()}

        {/* Loading state */}
        {reportLoading && (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full rounded-md" />
            ))}
          </div>
        )}

        {/* Blocked state */}
        {!reportLoading && isBlocked && (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-20 text-center">
            <Lock className="mb-4 size-12 text-muted-foreground/40" />
            <h2 className="text-lg font-semibold text-muted-foreground">
              Relatorio nao liberado
            </h2>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground/70">
              O relatorio de {formatMonth(currentMonth)} ainda nao foi liberado pelo administrador. Voce sera notificado quando estiver disponivel.
            </p>
          </div>
        )}

        {/* Tabs — visivel quando nao bloqueado e nao carregando */}
        {!reportLoading && !isBlocked && (
          /* Tabs */
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="appointments">Atendimentos</TabsTrigger>
              <TabsTrigger value="operators">Operadores</TabsTrigger>
              <TabsTrigger value="shifts">Turnos</TabsTrigger>
              <TabsTrigger value="contestation" className="gap-1.5">
                <MessageSquare className="size-3.5" />
                Contestacao
                {(report?.thread?.length ?? 0) > 0 && (
                  <Badge variant="secondary" className="ml-1 h-5 min-w-5 px-1.5 text-[10px]">
                    {report!.thread.length}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="appointments" className="mt-4">
              <AppointmentsTab isAdmin={isAdmin} appointments={report?.appointments ?? []} professionalId={Number(selectedId)} month={currentMonth} />
            </TabsContent>

            <TabsContent value="operators" className="mt-4">
              <OperatorsTab operators={report?.operators ?? []} />
            </TabsContent>

            <TabsContent value="shifts" className="mt-4">
              <ShiftsTab
                professionalId={Number(selectedId)}
                isAdmin={isAdmin}
                shifts={report?.shifts ?? []}
                month={currentMonth}
              />
            </TabsContent>

            <TabsContent value="contestation" className="mt-4">
              <ContestationTab isAdmin={isAdmin} thread={report?.thread ?? []} releaseId={report?.release?.id ?? null} releaseStatus={releaseStatus} professionalId={Number(selectedId)} month={currentMonth} />
            </TabsContent>
          </Tabs>
        )}
      </div>

      {/* Dialog Contestar (profissional) */}
      <Dialog open={contestOpen} onOpenChange={(isOpen) => { if (!isOpen) { setContestOpen(false); setContestNote(''); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Contestar Relatorio</DialogTitle>
            <DialogDescription>
              Descreva o motivo da contestacao. O administrador sera notificado e podera responder na aba de contestacao.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Descreva o motivo da contestacao..."
            value={contestNote}
            onChange={(e) => setContestNote(e.target.value)}
            rows={4}
            className="resize-none"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => { setContestOpen(false); setContestNote(''); }} disabled={contestRelease.isPending}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleContest} disabled={contestRelease.isPending || !contestNote.trim()}>
              {contestRelease.isPending && <Loader2 className="size-4 animate-spin" />}
              Enviar Contestacao
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}

import { useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Plus, Wand2, Trash2, Calendar, Check, X } from 'lucide-react';
import type { ShiftPeriod, ShiftModality } from '@cpro/shared';
import { AppLayout } from '@/components/layout/AppLayout';
import { ProfessionalSelect } from '@/components/domain/ProfessionalSelect';
import { ShiftFormModal } from '@/components/domain/ShiftFormModal';
import { ConfirmDialog } from '@/components/domain/ConfirmDialog';
import { SortableHeader } from '@/components/domain/SortableHeader';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useSortableTable } from '@/hooks/useSortableTable';
import {
  useShifts,
  useCreateShift,
  useUpdateShift,
  useDeleteShift,
  useInferShifts,
} from '@/hooks/useApi';
import type { Shift } from '@/hooks/useApi';
import {
  formatCurrency,
  formatDayOfWeek,
  formatPeriod,
  formatModality,
} from '@/lib/format';
import { useUiStore } from '@/stores/uiStore';

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

export function ShiftsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const currentMonth = useUiStore((s) => s.currentMonth);

  // Profissional selecionado — default vindo da URL ou vazio
  const [selectedId, setSelectedId] = useState<string>(id ?? '');

  // Modais
  const [formOpen, setFormOpen] = useState(false);
  const [inferOpen, setInferOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Shift | null>(null);

  // Inline edit state
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editDay, setEditDay] = useState('1');
  const [editPeriod, setEditPeriod] = useState<ShiftPeriod>('morning');
  const [editModality, setEditModality] = useState<ShiftModality>('presencial');
  const [editValue, setEditValue] = useState(0);

  // Hooks de dados reais
  const { data: shifts = [], isLoading } = useShifts(Number(selectedId), currentMonth);
  const createShift = useCreateShift();
  const updateShift = useUpdateShift();
  const deleteShift = useDeleteShift();
  const inferShifts = useInferShifts();

  const { sorted, sortKey, sortDir, toggleSort } = useSortableTable(
    shifts,
    'dayOfWeek' as keyof Shift,
  );

  const handleProfessionalChange = useCallback(
    (newId: string) => {
      setSelectedId(newId);
      navigate(`/shifts/${newId}`, { replace: true });
    },
    [navigate],
  );

  function handleCreateShift(formData: {
    dayOfWeek: number;
    period: import('@cpro/shared').ShiftPeriod;
    modality: import('@cpro/shared').ShiftModality;
    shiftValue: number;
  }) {
    createShift.mutate(
      {
        professionalId: Number(selectedId),
        month: currentMonth,
        ...formData,
      },
      { onSuccess: () => setFormOpen(false) },
    );
  }

  function handleInfer() {
    inferShifts.mutate(
      { professionalId: Number(selectedId), month: currentMonth },
      { onSuccess: () => setInferOpen(false) },
    );
  }

  function handleDelete() {
    if (!deleteTarget) return;
    deleteShift.mutate(
      { id: deleteTarget.id, professionalId: Number(selectedId), month: currentMonth },
      { onSuccess: () => setDeleteTarget(null) },
    );
  }

  function startEdit(shift: Shift) {
    setEditingId(shift.id);
    setEditDay(String(shift.dayOfWeek));
    setEditPeriod(shift.period as ShiftPeriod);
    setEditModality(shift.modality as ShiftModality);
    setEditValue(shift.shiftValue);
  }

  function cancelEdit() {
    setEditingId(null);
  }

  function saveEdit(shiftId: number) {
    updateShift.mutate(
      {
        id: shiftId,
        professionalId: Number(selectedId),
        month: currentMonth,
        dayOfWeek: Number(editDay),
        period: editPeriod,
        modality: editModality,
        shiftValue: editValue,
      },
      { onSuccess: () => setEditingId(null) },
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Calendar className="size-5" />
            </div>
            <div>
              <h1 className="text-xl font-semibold">Turnos</h1>
              {selectedId && (
                <p className="text-sm text-muted-foreground">
                  Profissional #{selectedId}
                </p>
              )}
            </div>
          </div>

          <ProfessionalSelect
            value={selectedId}
            onChange={handleProfessionalChange}
            className="w-full sm:w-72"
          />
        </div>

        {/* Actions bar */}
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => setFormOpen(true)}>
            <Plus className="size-4" />
            Turno Manual
          </Button>
          <Button variant="outline" onClick={() => setInferOpen(true)}>
            <Wand2 className="size-4" />
            Inferir Turnos
          </Button>
        </div>

        {/* Table */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12 text-center">
            <p className="text-sm text-muted-foreground">Carregando turnos...</p>
          </div>
        ) : sorted.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12 text-center">
            <Calendar className="mb-3 size-10 text-muted-foreground/50" />
            <p className="text-sm font-medium text-muted-foreground">
              Nenhum turno encontrado
            </p>
            <p className="mt-1 text-xs text-muted-foreground/70">
              Crie turnos manualmente ou use "Inferir Turnos" para gerar automaticamente.
            </p>
          </div>
        ) : (
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    <SortableHeader
                      label="Dia"
                      sortKey="dayOfWeek"
                      currentKey={String(sortKey)}
                      currentDir={sortDir}
                      onSort={(k) => toggleSort(k as keyof Shift)}
                    />
                  </TableHead>
                  <TableHead>
                    <SortableHeader
                      label="Periodo"
                      sortKey="period"
                      currentKey={String(sortKey)}
                      currentDir={sortDir}
                      onSort={(k) => toggleSort(k as keyof Shift)}
                    />
                  </TableHead>
                  <TableHead>
                    <SortableHeader
                      label="Tipo"
                      sortKey="modality"
                      currentKey={String(sortKey)}
                      currentDir={sortDir}
                      onSort={(k) => toggleSort(k as keyof Shift)}
                    />
                  </TableHead>
                  <TableHead className="text-right">
                    <SortableHeader
                      label="Valor (R$)"
                      sortKey="shiftValue"
                      currentKey={String(sortKey)}
                      currentDir={sortDir}
                      onSort={(k) => toggleSort(k as keyof Shift)}
                      className="justify-end"
                    />
                  </TableHead>
                  <TableHead>
                    <SortableHeader
                      label="Origem"
                      sortKey="origin"
                      currentKey={String(sortKey)}
                      currentDir={sortDir}
                      onSort={(k) => toggleSort(k as keyof Shift)}
                    />
                  </TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.map((shift) =>
                  editingId === shift.id ? (
                    <TableRow key={shift.id} className="bg-muted/30">
                      <TableCell>
                        <Select value={editDay} onValueChange={setEditDay}>
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
                        <Select value={editPeriod} onValueChange={(v) => setEditPeriod(v as ShiftPeriod)}>
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
                        <Select value={editModality} onValueChange={(v) => setEditModality(v as ShiftModality)}>
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
                          value={editValue}
                          onChange={(e) => setEditValue(Number(e.target.value))}
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
                            onClick={() => saveEdit(shift.id)}
                            disabled={updateShift.isPending}
                          >
                            <Check className="size-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7 text-muted-foreground hover:text-foreground"
                            onClick={cancelEdit}
                          >
                            <X className="size-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    <TableRow
                      key={shift.id}
                      className="cursor-pointer"
                      onClick={() => startEdit(shift)}
                    >
                      <TableCell className="font-medium">
                        {formatDayOfWeek(shift.dayOfWeek)}
                      </TableCell>
                      <TableCell>{formatPeriod(shift.period)}</TableCell>
                      <TableCell>
                        <Badge
                          variant={shift.modality === 'presencial' ? 'default' : 'secondary'}
                        >
                          {formatModality(shift.modality)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatCurrency(shift.shiftValue)}
                      </TableCell>
                      <TableCell>
                        <span className="text-xs text-muted-foreground capitalize">
                          {shift.origin === 'inferred' ? 'Inferido' : 'Manual'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8 text-muted-foreground hover:text-destructive"
                          onClick={(e) => { e.stopPropagation(); setDeleteTarget(shift); }}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ),
                )}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Total de turnos */}
        {sorted.length > 0 && (
          <p className="text-sm text-muted-foreground">
            {sorted.length} turno{sorted.length !== 1 ? 's' : ''} &middot;{' '}
            Total: {formatCurrency(sorted.reduce((acc, s) => acc + s.shiftValue, 0))}
          </p>
        )}
      </div>

      {/* Modal Criar Turno */}
      <ShiftFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSubmit={handleCreateShift}
        isLoading={createShift.isPending}
      />

      {/* Dialog Inferir Turnos */}
      <ConfirmDialog
        open={inferOpen}
        onClose={() => setInferOpen(false)}
        onConfirm={handleInfer}
        title="Inferir Turnos"
        description={`Deseja inferir os turnos do profissional #${selectedId} com base nos atendimentos do mes? Turnos existentes nao serao removidos.`}
        confirmLabel="Inferir"
        isLoading={inferShifts.isPending}
      />

      {/* Dialog Deletar Turno */}
      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Excluir Turno"
        description={
          deleteTarget
            ? `Deseja excluir o turno de ${formatDayOfWeek(deleteTarget.dayOfWeek)} (${formatPeriod(deleteTarget.period)}) — ${formatCurrency(deleteTarget.shiftValue)}?`
            : ''
        }
        confirmLabel="Excluir"
        variant="destructive"
        isLoading={deleteShift.isPending}
      />
    </AppLayout>
  );
}

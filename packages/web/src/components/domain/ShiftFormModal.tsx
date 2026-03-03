import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import type { ShiftPeriod, ShiftModality } from '@cpro/shared';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { mockShiftConfig } from '@/lib/mockData';

interface ShiftFormData {
  dayOfWeek: number;
  period: ShiftPeriod;
  modality: ShiftModality;
  shiftValue: number;
}

interface ShiftFormModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: ShiftFormData) => void;
  isLoading?: boolean;
}

const DAYS = [
  { value: '1', label: 'Segunda' },
  { value: '2', label: 'Terca' },
  { value: '3', label: 'Quarta' },
  { value: '4', label: 'Quinta' },
  { value: '5', label: 'Sexta' },
  { value: '6', label: 'Sabado' },
];

const PERIODS: { value: ShiftPeriod; label: string }[] = [
  { value: 'morning', label: 'Manha' },
  { value: 'afternoon', label: 'Tarde' },
  { value: 'evening', label: 'Noite' },
];

const MODALITIES: { value: ShiftModality; label: string }[] = [
  { value: 'presencial', label: 'Presencial' },
  { value: 'online', label: 'Online' },
];

export function ShiftFormModal({
  open,
  onClose,
  onSubmit,
  isLoading = false,
}: ShiftFormModalProps) {
  const [dayOfWeek, setDayOfWeek] = useState('1');
  const [period, setPeriod] = useState<ShiftPeriod>('morning');
  const [modality, setModality] = useState<ShiftModality>('presencial');
  const [shiftValue, setShiftValue] = useState(mockShiftConfig.shiftPresencial);

  // Pre-preenche valor quando muda modalidade
  useEffect(() => {
    setShiftValue(
      modality === 'presencial'
        ? mockShiftConfig.shiftPresencial
        : mockShiftConfig.shiftOnline,
    );
  }, [modality]);

  // Reset ao abrir
  useEffect(() => {
    if (open) {
      setDayOfWeek('1');
      setPeriod('morning');
      setModality('presencial');
      setShiftValue(mockShiftConfig.shiftPresencial);
    }
  }, [open]);

  function handleSubmit() {
    onSubmit({
      dayOfWeek: Number(dayOfWeek),
      period,
      modality,
      shiftValue,
    });
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent showCloseButton={!isLoading}>
        <DialogHeader>
          <DialogTitle>Novo Turno Manual</DialogTitle>
          <DialogDescription>
            Adicione um turno para o profissional selecionado.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          {/* Dia da semana */}
          <div className="grid gap-2">
            <Label>Dia da semana</Label>
            <Select value={dayOfWeek} onValueChange={setDayOfWeek}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DAYS.map((d) => (
                  <SelectItem key={d.value} value={d.value}>
                    {d.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Periodo */}
          <div className="grid gap-2">
            <Label>Periodo</Label>
            <Select value={period} onValueChange={(v) => setPeriod(v as ShiftPeriod)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PERIODS.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Tipo (modalidade) */}
          <div className="grid gap-2">
            <Label>Tipo</Label>
            <Select value={modality} onValueChange={(v) => setModality(v as ShiftModality)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MODALITIES.map((m) => (
                  <SelectItem key={m.value} value={m.value}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Valor */}
          <div className="grid gap-2">
            <Label>Valor (R$)</Label>
            <Input
              type="number"
              min={0}
              step={0.01}
              value={shiftValue}
              onChange={(e) => setShiftValue(Number(e.target.value))}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={isLoading}>
            {isLoading && <Loader2 className="size-4 animate-spin" />}
            Criar Turno
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Helpers de formatacao para moeda, datas, meses e turnos.
 */

import type { ShiftPeriod, ShiftModality } from '@cpro/shared';

const MONTH_NAMES: Record<string, string> = {
  '01': 'Janeiro',
  '02': 'Fevereiro',
  '03': 'Marco',
  '04': 'Abril',
  '05': 'Maio',
  '06': 'Junho',
  '07': 'Julho',
  '08': 'Agosto',
  '09': 'Setembro',
  '10': 'Outubro',
  '11': 'Novembro',
  '12': 'Dezembro',
};

const MONTH_NAMES_SHORT: Record<string, string> = {
  '01': 'Jan',
  '02': 'Fev',
  '03': 'Mar',
  '04': 'Abr',
  '05': 'Mai',
  '06': 'Jun',
  '07': 'Jul',
  '08': 'Ago',
  '09': 'Set',
  '10': 'Out',
  '11': 'Nov',
  '12': 'Dez',
};

/**
 * Formata numero em moeda brasileira.
 * Nunca trunca o valor.
 * Ex: 12500 → "R$ 12.500,00"
 */
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/**
 * Formata mes em formato longo.
 * Ex: "2026-03" → "Marco 2026"
 */
export function formatMonth(month: string): string {
  if (!month || !month.includes('-')) return month;
  const parts = month.split('-');
  const year = parts[0] ?? '';
  const mm = parts[1] ?? '';
  const name = MONTH_NAMES[mm] ?? mm;
  return `${name} ${year}`;
}

/**
 * Formata mes em formato curto.
 * Ex: "2026-03" → "Mar/2026"
 */
export function formatMonthShort(month: string): string {
  if (!month || !month.includes('-')) return month;
  const parts = month.split('-');
  const year = parts[0] ?? '';
  const mm = parts[1] ?? '';
  const name = MONTH_NAMES_SHORT[mm] ?? mm;
  return `${name}/${year}`;
}

/**
 * Formata data ISO (YYYY-MM-DD) em formato brasileiro (DD/MM/YYYY).
 */
export function formatDate(date: string): string {
  if (!date || !date.includes('-')) return date;
  const [y, m, d] = date.split('-');
  return `${d}/${m}/${y}`;
}

/**
 * Formata datetime ISO em formato brasileiro com horario.
 */
export function formatDateTime(datetime: string): string {
  if (!datetime) return datetime;
  const d = new Date(datetime);
  if (isNaN(d.getTime())) return datetime;
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ---------------------------------------------------------------------------
// Dia da semana (1=Seg ... 6=Sab)
// ---------------------------------------------------------------------------

const DAY_NAMES: Record<number, string> = {
  1: 'Segunda',
  2: 'Terca',
  3: 'Quarta',
  4: 'Quinta',
  5: 'Sexta',
  6: 'Sabado',
};

const DAY_NAMES_SHORT: Record<number, string> = {
  1: 'Seg',
  2: 'Ter',
  3: 'Qua',
  4: 'Qui',
  5: 'Sex',
  6: 'Sab',
};

export function formatDayOfWeek(day: number): string {
  return DAY_NAMES[day] ?? String(day);
}

export function formatDayOfWeekShort(day: number): string {
  return DAY_NAMES_SHORT[day] ?? String(day);
}

// ---------------------------------------------------------------------------
// Periodo e modalidade de turno
// ---------------------------------------------------------------------------

const PERIOD_LABELS: Record<ShiftPeriod, string> = {
  morning: 'Manha',
  afternoon: 'Tarde',
  evening: 'Noite',
};

const MODALITY_LABELS: Record<ShiftModality, string> = {
  presencial: 'Presencial',
  online: 'Online',
};

export function formatPeriod(period: ShiftPeriod): string {
  return PERIOD_LABELS[period] ?? period;
}

export function formatModality(modality: ShiftModality): string {
  return MODALITY_LABELS[modality] ?? modality;
}

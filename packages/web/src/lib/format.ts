/**
 * Helpers de formatacao para moeda, datas e meses.
 */

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

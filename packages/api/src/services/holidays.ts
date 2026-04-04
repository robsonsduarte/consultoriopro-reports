/**
 * Feriados — Itabuna/BA
 * Nacionais (fixos + moveis), estaduais (BA) e municipais (Itabuna).
 */

// Computus — calcula Pascoa para qualquer ano (Meeus/Jones/Butcher)
function getEasterDate(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86400000);
}

function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Retorna Set de datas YYYY-MM-DD de feriados para o ano */
export function getHolidays(year: number): Set<string> {
  const holidays = new Set<string>();

  // Nacionais fixos
  holidays.add(`${year}-01-01`); // Confraternizacao Universal
  holidays.add(`${year}-04-21`); // Tiradentes
  holidays.add(`${year}-05-01`); // Dia do Trabalho
  holidays.add(`${year}-09-07`); // Independencia do Brasil
  holidays.add(`${year}-10-12`); // Nossa Senhora Aparecida
  holidays.add(`${year}-11-02`); // Finados
  holidays.add(`${year}-11-15`); // Proclamacao da Republica
  holidays.add(`${year}-12-25`); // Natal

  // Estadual (Bahia)
  holidays.add(`${year}-07-02`); // Independencia da Bahia

  // Municipal (Itabuna)
  holidays.add(`${year}-03-19`); // Sao Jose (padroeiro)
  holidays.add(`${year}-11-14`); // Aniversario de Itabuna

  // Moveis (baseados na Pascoa)
  const easter = getEasterDate(year);
  holidays.add(formatDate(addDays(easter, -48))); // Segunda de Carnaval
  holidays.add(formatDate(addDays(easter, -47))); // Terca de Carnaval
  holidays.add(formatDate(addDays(easter, -2)));  // Sexta-feira Santa
  holidays.add(formatDate(addDays(easter, 60)));  // Corpus Christi

  return holidays;
}

/** Verifica se uma data YYYY-MM-DD e feriado */
export function isHoliday(dateStr: string): boolean {
  const year = Number(dateStr.split('-')[0]);
  return getHolidays(year).has(dateStr);
}

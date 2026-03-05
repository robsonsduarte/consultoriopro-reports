/**
 * Normaliza nome para comparacao case-insensitive e sem acentos.
 * Usado para match de guideNumber entre appointments e executions.
 */
export function normalizeName(name: string): string {
  return name.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').replace(/\s+/g, ' ').trim();
}

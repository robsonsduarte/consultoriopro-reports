import { useState, useMemo } from 'react';

type SortDir = 'asc' | 'desc';

interface UseSortableTableReturn<T> {
  sorted: T[];
  sortKey: keyof T;
  sortDir: SortDir;
  toggleSort: (key: keyof T) => void;
}

/**
 * Hook generico de sorting para tabelas.
 * Mantem sortKey e sortDir no estado local e retorna os dados ordenados.
 */
export function useSortableTable<T>(
  data: T[],
  defaultKey: keyof T,
  defaultDir: SortDir = 'asc',
): UseSortableTableReturn<T> {
  const [sortKey, setSortKey] = useState<keyof T>(defaultKey);
  const [sortDir, setSortDir] = useState<SortDir>(defaultDir);

  function toggleSort(key: keyof T) {
    if (key === sortKey) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  }

  const sorted = useMemo(() => {
    return [...data].sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];

      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;

      let comparison = 0;

      if (typeof aVal === 'string' && typeof bVal === 'string') {
        comparison = aVal.localeCompare(bVal, 'pt-BR', { sensitivity: 'base' });
      } else if (typeof aVal === 'number' && typeof bVal === 'number') {
        comparison = aVal - bVal;
      } else {
        comparison = String(aVal).localeCompare(String(bVal));
      }

      return sortDir === 'asc' ? comparison : -comparison;
    });
  }, [data, sortKey, sortDir]);

  return { sorted, sortKey, sortDir, toggleSort };
}

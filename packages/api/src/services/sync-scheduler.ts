// sync-scheduler.ts — Agendamento de sync automatico

import { syncProfessionals, syncAllReports } from './sync-worker.js';

let professionalsInterval: ReturnType<typeof setInterval> | null = null;
let reportsInterval: ReturnType<typeof setInterval> | null = null;

function getCurrentMonth(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

export function startSyncScheduler(): void {
  console.log('[sync-scheduler] Iniciando scheduler de sincronizacao...');

  // Sync inicial ao boot (com delay de 10s para deixar API estabilizar)
  setTimeout(() => {
    console.log('[sync-scheduler] Executando sync inicial...');
    void (async () => {
      try {
        await syncProfessionals();
        // Sync de reports do mes atual em background
        const month = getCurrentMonth();
        await syncAllReports(month);
      } catch (err) {
        console.error('[sync-scheduler] Erro no sync inicial:', err);
      }
    })();
  }, 10_000);

  // Profissionais: a cada 6 horas
  professionalsInterval = setInterval(() => {
    void (async () => {
      try {
        await syncProfessionals();
      } catch (err) {
        console.error(
          '[sync-scheduler] Erro no sync de profissionais:',
          err,
        );
      }
    })();
  }, 6 * 60 * 60 * 1000);

  // Reports do mes atual: a cada 30 minutos
  reportsInterval = setInterval(() => {
    void (async () => {
      try {
        const month = getCurrentMonth();
        await syncAllReports(month);
      } catch (err) {
        console.error('[sync-scheduler] Erro no sync de reports:', err);
      }
    })();
  }, 30 * 60 * 1000);
}

export function stopSyncScheduler(): void {
  if (professionalsInterval) clearInterval(professionalsInterval);
  if (reportsInterval) clearInterval(reportsInterval);
  professionalsInterval = null;
  reportsInterval = null;
  console.log('[sync-scheduler] Scheduler parado.');
}

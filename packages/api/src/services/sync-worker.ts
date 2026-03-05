// sync-worker.ts — Sync Worker para mirror local

import { db } from '../db/index.js';
import {
  professionalsMirror,
  appointmentsMirror,
  reportSummaryMirror,
  syncLog,
} from '../db/schema.js';
import { externalApi } from './external-api.js';
import { eq, and, notInArray, desc, isNull } from 'drizzle-orm';
import type { ExternalExecution } from './external-api.js';
import { normalizeName } from '../utils/normalize.js';

// Tipos para eventos de progresso
export interface SyncProgress {
  jobId: string;
  status: 'running' | 'completed' | 'error';
  total: number;
  completed: number;
  currentProfessional: string | null;
  startedAt: Date;
  errors: string[];
}

// Store em memoria para progresso de jobs
const activeJobs = new Map<string, SyncProgress>();

export function getSyncProgress(jobId: string): SyncProgress | null {
  return activeJobs.get(jobId) ?? null;
}

// Gera job ID
function createJobId(): string {
  return `sync-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// Lock para evitar syncs concorrentes do mesmo profissional+mes
const activeSyncLocks = new Set<string>();

function lockKey(professionalId: number, month: string): string {
  return `${professionalId}-${month}`;
}

// Helper: atualiza sync_log
async function updateSyncLog(
  entity: string,
  professionalId: number | null,
  month: string | null,
  status: 'idle' | 'running' | 'error',
  error?: string,
): Promise<void> {
  const conditions = [eq(syncLog.entity, entity)];
  if (professionalId !== null) {
    conditions.push(eq(syncLog.professionalId, professionalId));
  } else {
    conditions.push(isNull(syncLog.professionalId));
  }
  if (month !== null) {
    conditions.push(eq(syncLog.month, month));
  } else {
    conditions.push(isNull(syncLog.month));
  }

  const existing = await db
    .select()
    .from(syncLog)
    .where(and(...conditions))
    .limit(1);

  if (existing.length > 0) {
    const row = existing[0]!;
    await db
      .update(syncLog)
      .set({
        status,
        lastSyncedAt: status === 'idle' ? new Date() : row.lastSyncedAt,
        errorCount: status === 'error' ? row.errorCount + 1 : 0,
        lastError: error ?? null,
        updatedAt: new Date(),
      })
      .where(eq(syncLog.id, row.id));
  } else {
    await db.insert(syncLog).values({
      entity,
      professionalId,
      month,
      status,
      lastSyncedAt: status === 'idle' ? new Date() : null,
      errorCount: status === 'error' ? 1 : 0,
      lastError: error ?? null,
    });
  }
}

// 1. Sync Profissionais
export async function syncProfessionals(): Promise<void> {
  await updateSyncLog('professionals', null, null, 'running');
  try {
    const professionals = await externalApi.getProfessionals();
    for (const prof of professionals) {
      await db
        .insert(professionalsMirror)
        .values({
          externalId: prof.id,
          name: prof.name,
          specialty: prof.specialty,
          lastSyncedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [professionalsMirror.externalId],
          set: {
            name: prof.name,
            specialty: prof.specialty,
            lastSyncedAt: new Date(),
          },
        });
    }
    await updateSyncLog('professionals', null, null, 'idle');
    console.log(
      `[sync-worker] Profissionais sincronizados: ${professionals.length}`,
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await updateSyncLog('professionals', null, null, 'error', msg);
    console.error('[sync-worker] Erro ao sincronizar profissionais:', msg);
  }
}

// 2. Sync Report de um profissional+mes
export async function syncReport(
  professionalId: number,
  month: string,
): Promise<void> {
  const key = lockKey(professionalId, month);
  if (activeSyncLocks.has(key)) {
    console.log(`[sync-worker] Sync ja em andamento para prof=${professionalId} month=${month}, ignorando`);
    return;
  }
  activeSyncLocks.add(key);
  try {
    await updateSyncLog('report', professionalId, month, 'running');
    try {
      // Buscar report + executions do cPanel
      const [report, executions] = await Promise.all([
        externalApi.getReport(professionalId, month),
        externalApi
          .fetchExecutions(professionalId, month)
          .catch(() => [] as ExternalExecution[]),
      ]);

      // Montar indice guideNumber (mesma logica de report.ts)
      const executionIndex = new Map<string, string | null>();
      for (const exec of executions) {
        if (!exec.attendanceDay) continue;
        const key = `${exec.attendanceDay}|${normalizeName(exec.patientName)}`;
        if (!executionIndex.has(key) || executionIndex.get(key) === null) {
          executionIndex.set(key, exec.guideNumber);
        }
      }

      // Upsert appointments_mirror
      const syncedExternalIds: number[] = [];
      for (const appt of report.appointments) {
        const lookupKey = `${appt.date}|${normalizeName(appt.patientName)}`;
        const guideNumber = executionIndex.get(lookupKey) ?? null;

        await db
          .insert(appointmentsMirror)
          .values({
            externalId: appt.id,
            professionalId,
            month,
            date: appt.date,
            time: appt.time,
            patientName: appt.patientName,
            operatorName: appt.operatorName,
            value: String(appt.value),
            guideNumber,
            lastSyncedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: [
              appointmentsMirror.externalId,
              appointmentsMirror.professionalId,
            ],
            set: {
              date: appt.date,
              time: appt.time,
              patientName: appt.patientName,
              operatorName: appt.operatorName,
              value: String(appt.value),
              guideNumber,
              lastSyncedAt: new Date(),
            },
          });
        syncedExternalIds.push(appt.id);
      }

      // Remover appointments que nao vieram mais (deletados no cPanel)
      if (syncedExternalIds.length > 0) {
        await db.delete(appointmentsMirror).where(
          and(
            eq(appointmentsMirror.professionalId, professionalId),
            eq(appointmentsMirror.month, month),
            notInArray(appointmentsMirror.externalId, syncedExternalIds),
          ),
        );
      }

      // Upsert report_summary_mirror
      await db
        .insert(reportSummaryMirror)
        .values({
          professionalId,
          month,
          revenue: String(report.summary.revenue),
          taxRate: String(report.summary.taxRate),
          tax: String(report.summary.tax),
          netValue: String(report.summary.netValue),
          totalAppointments: report.summary.totalAppointments,
          operatorsSummary: JSON.stringify(report.operators),
          lastSyncedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [
            reportSummaryMirror.professionalId,
            reportSummaryMirror.month,
          ],
          set: {
            revenue: String(report.summary.revenue),
            taxRate: String(report.summary.taxRate),
            tax: String(report.summary.tax),
            netValue: String(report.summary.netValue),
            totalAppointments: report.summary.totalAppointments,
            operatorsSummary: JSON.stringify(report.operators),
            lastSyncedAt: new Date(),
          },
        });

      await updateSyncLog('report', professionalId, month, 'idle');
      console.log(
        `[sync-worker] Report sincronizado: prof=${professionalId} month=${month} (${report.appointments.length} appointments)`,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await updateSyncLog('report', professionalId, month, 'error', msg);
      console.error(
        `[sync-worker] Erro ao sincronizar report prof=${professionalId} month=${month}:`,
        msg,
      );
    }
  } finally {
    activeSyncLocks.delete(key);
  }
}

// 3. Sync de todos os profissionais ativos para um mes
export async function syncAllReports(month: string): Promise<string> {
  const jobId = createJobId();

  // Busca profissionais ativos do mirror (ja sincronizado)
  const professionals = await db.select().from(professionalsMirror);

  const progress: SyncProgress = {
    jobId,
    status: 'running',
    total: professionals.length,
    completed: 0,
    currentProfessional: null,
    startedAt: new Date(),
    errors: [],
  };
  activeJobs.set(jobId, progress);

  // Rodar em background (nao bloqueia a request)
  void (async () => {
    for (const prof of professionals) {
      progress.currentProfessional = prof.name;
      try {
        await syncReport(prof.externalId, month);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        progress.errors.push(`${prof.name}: ${msg}`);
      }
      progress.completed++;

      // Delay de 7s entre profissionais para evitar rate limiting
      if (progress.completed < professionals.length) {
        await new Promise<void>((r) => setTimeout(r, 7000));
      }
    }
    progress.status = progress.errors.length > 0 ? 'error' : 'completed';
    progress.currentProfessional = null;

    // Limpar job apos 10min
    setTimeout(() => activeJobs.delete(jobId), 10 * 60 * 1000);
  })();

  return jobId;
}

// 4. Sync individual (sem delay, rapido)
export async function syncSingleReport(
  professionalId: number,
  month: string,
): Promise<void> {
  // Mirror de profissionais ja e sincronizado pelo scheduler a cada 6h
  await syncReport(professionalId, month);
}

// 5. Obter status geral do sync
export async function getSyncStatus(): Promise<{
  lastSync: string | null;
  professionalsCount: number;
  activeJobs: Array<{
    jobId: string;
    status: string;
    completed: number;
    total: number;
  }>;
}> {
  // Ultimo sync de qualquer entidade
  const [lastLog] = await db
    .select()
    .from(syncLog)
    .where(eq(syncLog.status, 'idle'))
    .orderBy(desc(syncLog.lastSyncedAt))
    .limit(1);

  const profCount = await db.select().from(professionalsMirror);

  const jobs = Array.from(activeJobs.values()).map((j) => ({
    jobId: j.jobId,
    status: j.status,
    completed: j.completed,
    total: j.total,
  }));

  return {
    lastSync: lastLog?.lastSyncedAt?.toISOString() ?? null,
    professionalsCount: profCount.length,
    activeJobs: jobs,
  };
}

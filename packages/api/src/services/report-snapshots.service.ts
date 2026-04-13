import { eq, and, desc, sql, inArray } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  reportSnapshots,
  reportSnapshotAppointments,
  reportSnapshotShifts,
  users,
  professionalsMirror,
  reportReleases,
  professionalConfig,
} from '../db/schema.js';
import { buildLiveProfessionalReport, type LiveProfessionalReport } from './report-live.service.js';

export interface SnapshotMeta {
  source: 'live' | 'snapshot';
  snapshotId?: number;
  version?: number;
  name?: string;
  createdAt?: string;
}

export interface DashboardProfessionalRow {
  id: number;
  name: string;
  specialty: string;
  revenue: number;
  tax: number;
  shifts: number;
  shiftsValue: number;
  netValue: number;
  status: string | null;
  releaseId: number | null;
  isPaid: boolean;
  month: string;
}

// Payload congelado no campo JSONB `data` do snapshot.
// Contem o dashboard inteiro + taxRate corrente (auto-contido).
export interface SnapshotPayload {
  month: string;
  taxRate: number;
  dashboard: DashboardProfessionalRow[];
  // Summary por profissional (para reconstruir a view individual sem reler tabelas filhas).
  professionals: Record<number, {
    professional: { id: number; name: string; specialty: string };
    summary: {
      revenue: number;
      tax: number;
      shiftsValue: number;
      netValue: number;
      totalAppointments: number;
    };
    operators: Array<{ name: string; appointmentCount: number; totalValue: number }>;
  }>;
}

export type ReportSnapshotRow = typeof reportSnapshots.$inferSelect;

const MES_PT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

export function buildSnapshotName(month: string, version: number): string {
  const [year, mm] = month.split('-');
  const monthIdx = Number(mm) - 1;
  const mesLabel = MES_PT[monthIdx] ?? mm;
  return `${mesLabel}_${year}_v${version}`;
}

export async function listSnapshots(month: string): Promise<ReportSnapshotRow[]> {
  return db
    .select()
    .from(reportSnapshots)
    .where(eq(reportSnapshots.month, month))
    .orderBy(desc(reportSnapshots.version));
}

export async function getActiveSnapshot(month: string): Promise<ReportSnapshotRow | null> {
  const [row] = await db
    .select()
    .from(reportSnapshots)
    .where(and(eq(reportSnapshots.month, month), eq(reportSnapshots.isActive, true)))
    .limit(1);
  return row ?? null;
}

async function getGlobalTaxRate(): Promise<number> {
  const [cfg] = await db
    .select()
    .from(professionalConfig)
    .where(and(eq(professionalConfig.professionalId, 0), eq(professionalConfig.key, 'tax_rate')))
    .limit(1);
  return cfg ? Number(cfg.value) : 15;
}

async function getActiveProfessionalIds(): Promise<number[]> {
  const activeUsers = await db
    .select({ apiProfessionalId: users.apiProfessionalId })
    .from(users)
    .where(and(eq(users.isActive, true), sql`${users.apiProfessionalId} IS NOT NULL`));

  const ids = activeUsers
    .map((u) => u.apiProfessionalId)
    .filter((id): id is number => id !== null);

  if (ids.length === 0) return [];

  const mirrors = await db
    .select({ externalId: professionalsMirror.externalId })
    .from(professionalsMirror)
    .where(inArray(professionalsMirror.externalId, ids));

  return mirrors.map((m) => m.externalId);
}

export async function saveSnapshot(
  month: string,
  createdBy: number,
): Promise<ReportSnapshotRow> {
  // 1. Calcular proxima versao
  const [maxRow] = await db
    .select({ maxVersion: sql<number | null>`max(${reportSnapshots.version})` })
    .from(reportSnapshots)
    .where(eq(reportSnapshots.month, month));

  const nextVersion = (maxRow?.maxVersion ?? 0) + 1;
  const name = buildSnapshotName(month, nextVersion);

  // 2. Buscar profissionais ativos
  const professionalIds = await getActiveProfessionalIds();
  const taxRate = await getGlobalTaxRate();

  if (professionalIds.length === 0) {
    throw new Error('Nenhum profissional ativo encontrado para snapshot');
  }

  // 3. Montar relatorio live de cada profissional (sequencial para nao sobrecarregar API externa)
  const liveReports: LiveProfessionalReport[] = [];
  for (const profId of professionalIds) {
    const r = await buildLiveProfessionalReport(profId, month);
    liveReports.push(r);
  }

  // 4. Buscar releases do mes (para congelar status no dashboard payload)
  const releases = await db
    .select()
    .from(reportReleases)
    .where(eq(reportReleases.month, month));
  const releaseMap = new Map(releases.map((r) => [r.professionalId, r]));

  // 5. Montar payload JSONB
  const dashboard: DashboardProfessionalRow[] = liveReports.map((r) => {
    const release = releaseMap.get(r.professional.id);
    return {
      id: r.professional.id,
      name: r.professional.name,
      specialty: r.professional.specialty,
      revenue: r.summary.revenue,
      tax: r.summary.tax,
      shifts: r.shifts.length,
      shiftsValue: r.summary.shiftsValue,
      netValue: r.summary.netValue,
      status: release?.status ?? null,
      releaseId: release?.id ?? null,
      isPaid: release?.isPaid ?? false,
      month,
    };
  });
  dashboard.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));

  const professionalsMap: SnapshotPayload['professionals'] = {};
  for (const r of liveReports) {
    professionalsMap[r.professional.id] = {
      professional: r.professional,
      summary: r.summary,
      operators: r.operators,
    };
  }

  const payload: SnapshotPayload = {
    month,
    taxRate,
    dashboard,
    professionals: professionalsMap,
  };

  // 6. Transacao: desativar versoes anteriores + inserir snapshot + bulk filhos
  const created = await db.transaction(async (tx) => {
    await tx
      .update(reportSnapshots)
      .set({ isActive: false })
      .where(eq(reportSnapshots.month, month));

    const insertedRows = await tx
      .insert(reportSnapshots)
      .values({
        month,
        version: nextVersion,
        name,
        isActive: true,
        data: payload,
        createdBy,
      })
      .returning();

    const inserted = insertedRows[0];
    if (!inserted) {
      throw new Error('Falha ao inserir snapshot');
    }

    // Bulk insert dos atendimentos
    const apptRows = liveReports.flatMap((r) =>
      r.appointments.map((a) => ({
        snapshotId: inserted.id,
        professionalId: r.professional.id,
        externalAppointmentId: a.id,
        date: a.date,
        time: a.time ?? '',
        patientName: a.patientName,
        operatorName: a.operatorName ?? '',
        guideNumber: a.guideNumber,
        value: String(a.value),
        isPaid: a.isPaid,
        isExcluded: false,
        sourceGone: a.sourceGone ?? false,
      })),
    );

    if (apptRows.length > 0) {
      // Chunks de 500 para evitar limite de parametros do PG
      for (let i = 0; i < apptRows.length; i += 500) {
        await tx.insert(reportSnapshotAppointments).values(apptRows.slice(i, i + 500));
      }
    }

    // Bulk insert dos turnos
    const shiftRows = liveReports.flatMap((r) =>
      r.shifts.map((s) => ({
        snapshotId: inserted.id,
        professionalId: r.professional.id,
        dayOfWeek: s.dayOfWeek,
        period: s.period as 'morning' | 'afternoon' | 'evening',
        modality: s.modality as 'presencial' | 'online',
        shiftValue: String(s.shiftValue),
        origin: s.origin,
      })),
    );

    if (shiftRows.length > 0) {
      for (let i = 0; i < shiftRows.length; i += 500) {
        await tx.insert(reportSnapshotShifts).values(shiftRows.slice(i, i + 500));
      }
    }

    return inserted;
  });

  return created;
}

export async function restoreSnapshot(targetId: number): Promise<ReportSnapshotRow> {
  return db.transaction(async (tx) => {
    const [target] = await tx
      .select()
      .from(reportSnapshots)
      .where(eq(reportSnapshots.id, targetId))
      .limit(1);

    if (!target) {
      throw new Error('Snapshot nao encontrado');
    }

    // Deletar versoes mais novas do mesmo mes (cascade remove filhos)
    await tx
      .delete(reportSnapshots)
      .where(and(
        eq(reportSnapshots.month, target.month),
        sql`${reportSnapshots.version} > ${target.version}`,
      ));

    // Garantir que so o target fica ativo
    await tx
      .update(reportSnapshots)
      .set({ isActive: false })
      .where(eq(reportSnapshots.month, target.month));

    const restoredRows = await tx
      .update(reportSnapshots)
      .set({ isActive: true })
      .where(eq(reportSnapshots.id, targetId))
      .returning();

    const restored = restoredRows[0];
    if (!restored) {
      throw new Error('Falha ao reativar snapshot');
    }

    return restored;
  });
}

export async function deleteSnapshot(snapshotId: number): Promise<void> {
  const [target] = await db
    .select()
    .from(reportSnapshots)
    .where(eq(reportSnapshots.id, snapshotId))
    .limit(1);

  if (!target) {
    throw new Error('Snapshot nao encontrado');
  }

  if (target.isActive) {
    throw new Error('Nao e possivel deletar a versao ativa. Restaure outra versao primeiro.');
  }

  await db.delete(reportSnapshots).where(eq(reportSnapshots.id, snapshotId));
}

export function buildDashboardFromSnapshot(
  snapshot: ReportSnapshotRow,
): DashboardProfessionalRow[] {
  const payload = snapshot.data as unknown as SnapshotPayload;
  return payload.dashboard ?? [];
}

// Reconstroi a view individual de um profissional a partir das tabelas filhas + payload JSONB.
// Retorna no mesmo shape de LiveProfessionalReport mas sem `release` e `thread` (esses vem do live no handler).
export async function buildProfessionalFromSnapshot(
  snapshot: ReportSnapshotRow,
  professionalId: number,
): Promise<Omit<LiveProfessionalReport, 'release' | 'thread'>> {
  const payload = snapshot.data as unknown as SnapshotPayload;
  const profData = payload.professionals?.[professionalId];

  if (!profData) {
    throw new Error(`Profissional ${professionalId} nao encontrado no snapshot ${snapshot.id}`);
  }

  const appts = await db
    .select()
    .from(reportSnapshotAppointments)
    .where(and(
      eq(reportSnapshotAppointments.snapshotId, snapshot.id),
      eq(reportSnapshotAppointments.professionalId, professionalId),
    ));

  const snapShifts = await db
    .select()
    .from(reportSnapshotShifts)
    .where(and(
      eq(reportSnapshotShifts.snapshotId, snapshot.id),
      eq(reportSnapshotShifts.professionalId, professionalId),
    ));

  const appointments = appts
    .map((a) => ({
      id: a.externalAppointmentId,
      date: a.date,
      time: a.time,
      patientName: a.patientName,
      operatorName: a.operatorName,
      value: Number(a.value),
      isPaid: a.isPaid,
      guideNumber: a.guideNumber,
      sourceGone: a.sourceGone ?? false,
    }))
    .sort((a, b) => a.date.localeCompare(b.date) || (a.time ?? '').localeCompare(b.time ?? ''));

  return {
    professional: profData.professional,
    month: snapshot.month,
    summary: profData.summary,
    appointments,
    operators: profData.operators,
    shifts: snapShifts.map((s) => ({
      id: s.id,
      professionalId: s.professionalId,
      month: snapshot.month,
      dayOfWeek: s.dayOfWeek,
      period: s.period,
      modality: s.modality,
      shiftValue: Number(s.shiftValue),
      origin: s.origin,
      createdAt: snapshot.createdAt.toISOString(),
    })),
  };
}


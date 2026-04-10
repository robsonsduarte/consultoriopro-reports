import { eq, and } from 'drizzle-orm';
import { externalApi } from './external-api.js';
import { db } from '../db/index.js';
import { normalizeName } from '../utils/normalize.js';
import {
  shifts,
  reportReleases,
  contestationMessages,
  appointmentOverrides,
  users,
  appointmentsMirror,
  reportSummaryMirror,
  professionalsMirror,
} from '../db/schema.js';

export interface LiveAppointment {
  id: number;
  date: string;
  time: string;
  patientName: string;
  operatorName: string;
  value: number;
  isPaid: boolean;
  guideNumber: string | null;
}

export interface LiveShift {
  id: number;
  professionalId: number;
  month: string;
  dayOfWeek: number;
  period: string;
  modality: string;
  shiftValue: number;
  origin: string;
  createdAt: string;
}

export interface LiveOperator {
  name: string;
  appointmentCount: number;
  totalValue: number;
}

export interface ThreadEntry {
  id: number;
  releaseId: number;
  senderName: string;
  senderRole: 'admin' | 'user';
  message: string;
  createdAt: string;
}

export interface LiveProfessionalReport {
  professional: { id: number; name: string; specialty: string };
  month: string;
  release: { id: number; status: string; isPaid: boolean } | null;
  summary: {
    revenue: number;
    tax: number;
    shiftsValue: number;
    netValue: number;
    totalAppointments: number;
  };
  appointments: LiveAppointment[];
  operators: LiveOperator[];
  shifts: LiveShift[];
  thread: ThreadEntry[];
}

// Monta relatorio "live" (sem snapshot) de um profissional.
// Usado pelo handler GET /report/:id e por saveSnapshot.
export async function buildLiveProfessionalReport(
  professionalId: number,
  month: string,
): Promise<LiveProfessionalReport> {
  const mirrorAppointments = await db.select().from(appointmentsMirror).where(
    and(eq(appointmentsMirror.professionalId, professionalId), eq(appointmentsMirror.month, month))
  );

  const [mirrorSummary] = await db.select().from(reportSummaryMirror).where(
    and(eq(reportSummaryMirror.professionalId, professionalId), eq(reportSummaryMirror.month, month))
  ).limit(1);

  const [mirrorProfessional] = await db.select().from(professionalsMirror).where(
    eq(professionalsMirror.externalId, professionalId)
  ).limit(1);

  // Fallback: se mirror vazio, usar API externa (pre-sync)
  if (mirrorAppointments.length === 0 && !mirrorSummary) {
    const [externalReport, executions] = await Promise.all([
      externalApi.getReport(professionalId, month),
      externalApi.fetchExecutions(professionalId, month).catch((err: unknown) => {
        console.warn('[report] fetchExecutions falhou, continuando sem guideNumber:', err);
        return [];
      }),
    ]);

    const executionIndex = new Map<string, string | null>();
    for (const exec of executions) {
      if (!exec.attendanceDay) continue;
      const key = `${exec.attendanceDay}|${normalizeName(exec.patientName)}`;
      if (!executionIndex.has(key) || executionIndex.get(key) === null) {
        executionIndex.set(key, exec.guideNumber);
      }
    }

    const overridesFb = await db
      .select()
      .from(appointmentOverrides)
      .where(and(
        eq(appointmentOverrides.professionalId, professionalId),
        eq(appointmentOverrides.month, month),
      ));

    const overrideMapFb = new Map(overridesFb.map((o) => [o.externalAppointmentId, o]));

    const appointmentsFb = externalReport.appointments
      .map((a) => {
        const override = overrideMapFb.get(Number(a.id));
        if (override?.isExcluded) return null;

        const lookupKey = `${a.date}|${normalizeName(a.patientName)}`;
        const guideNumber = executionIndex.get(lookupKey) ?? null;

        return {
          ...a,
          isPaid: override?.isPaid ?? a.isPaid,
          guideNumber,
        };
      })
      .filter((a): a is NonNullable<typeof a> => a !== null)
      .sort((a, b) => a.date.localeCompare(b.date) || (a.time ?? '').localeCompare(b.time ?? ''));

    const localShiftsFb = await db
      .select()
      .from(shifts)
      .where(and(eq(shifts.professionalId, professionalId), eq(shifts.month, month)));

    const [releaseFb] = await db
      .select()
      .from(reportReleases)
      .where(and(eq(reportReleases.professionalId, professionalId), eq(reportReleases.month, month)))
      .limit(1);

    const threadFb: ThreadEntry[] = releaseFb ? await fetchThread(releaseFb.id) : [];

    const revenueFb = appointmentsFb.reduce((sum, a) => sum + a.value, 0);
    const taxRateFb = externalReport.summary.taxRate;
    const taxFb = Math.round(revenueFb * (taxRateFb / 100) * 100) / 100;
    const shiftsValueFb = localShiftsFb.reduce((sum, s) => sum + Number(s.shiftValue), 0);
    const netValueFb = Math.round((revenueFb - taxFb - shiftsValueFb) * 100) / 100;

    return {
      professional: externalReport.professional,
      month,
      release: releaseFb
        ? { id: releaseFb.id, status: releaseFb.status, isPaid: releaseFb.isPaid }
        : null,
      summary: {
        revenue: Math.round(revenueFb * 100) / 100,
        tax: taxFb,
        shiftsValue: Math.round(shiftsValueFb * 100) / 100,
        netValue: netValueFb,
        totalAppointments: appointmentsFb.length,
      },
      appointments: appointmentsFb,
      operators: externalReport.operators,
      shifts: localShiftsFb.map((s) => ({
        id: s.id,
        professionalId: s.professionalId,
        month: s.month,
        dayOfWeek: s.dayOfWeek,
        period: s.period,
        modality: s.modality,
        shiftValue: Number(s.shiftValue),
        origin: s.origin,
        createdAt: s.createdAt.toISOString(),
      })),
      thread: threadFb,
    };
  }

  // Mirror path — leitura local
  const overrides = await db
    .select()
    .from(appointmentOverrides)
    .where(and(
      eq(appointmentOverrides.professionalId, professionalId),
      eq(appointmentOverrides.month, month),
    ));

  const overrideMap = new Map(overrides.map((o) => [o.externalAppointmentId, o]));

  const appointments: LiveAppointment[] = mirrorAppointments
    .map((a) => {
      const override = overrideMap.get(a.externalId);
      if (override?.isExcluded) return null;
      return {
        id: a.externalId,
        date: a.date,
        time: a.time,
        patientName: a.patientName,
        operatorName: a.operatorName,
        value: Number(a.value),
        isPaid: override?.isPaid ?? false,
        guideNumber: a.guideNumber,
      };
    })
    .filter((a): a is LiveAppointment => a !== null)
    .sort((a, b) => a.date.localeCompare(b.date) || (a.time ?? '').localeCompare(b.time ?? ''));

  const professional = mirrorProfessional
    ? { id: mirrorProfessional.externalId, name: mirrorProfessional.name, specialty: mirrorProfessional.specialty }
    : { id: professionalId, name: `Profissional ${professionalId}`, specialty: 'Geral' };

  const localShifts = await db
    .select()
    .from(shifts)
    .where(and(
      eq(shifts.professionalId, professionalId),
      eq(shifts.month, month),
    ));

  const [release] = await db
    .select()
    .from(reportReleases)
    .where(and(
      eq(reportReleases.professionalId, professionalId),
      eq(reportReleases.month, month),
    ))
    .limit(1);

  const thread: ThreadEntry[] = release ? await fetchThread(release.id) : [];

  const revenue = appointments.reduce((sum, a) => sum + a.value, 0);
  const taxRate = mirrorSummary ? Number(mirrorSummary.taxRate) : 15;
  const tax = Math.round(revenue * (taxRate / 100) * 100) / 100;
  const shiftsValue = localShifts.reduce((sum, s) => sum + Number(s.shiftValue), 0);
  const netValue = Math.round((revenue - tax - shiftsValue) * 100) / 100;

  const operators: LiveOperator[] = mirrorSummary
    ? (() => {
        try {
          return JSON.parse(mirrorSummary.operatorsSummary) as LiveOperator[];
        } catch {
          return [];
        }
      })()
    : [];

  return {
    professional,
    month,
    release: release
      ? { id: release.id, status: release.status, isPaid: release.isPaid }
      : null,
    summary: {
      revenue: Math.round(revenue * 100) / 100,
      tax,
      shiftsValue: Math.round(shiftsValue * 100) / 100,
      netValue,
      totalAppointments: appointments.length,
    },
    appointments,
    operators,
    shifts: localShifts.map((s) => ({
      id: s.id,
      professionalId: s.professionalId,
      month: s.month,
      dayOfWeek: s.dayOfWeek,
      period: s.period,
      modality: s.modality,
      shiftValue: Number(s.shiftValue),
      origin: s.origin,
      createdAt: s.createdAt.toISOString(),
    })),
    thread,
  };
}

export async function fetchThread(releaseId: number): Promise<ThreadEntry[]> {
  const messages = await db
    .select({
      id: contestationMessages.id,
      releaseId: contestationMessages.releaseId,
      message: contestationMessages.message,
      createdAt: contestationMessages.createdAt,
      userName: users.name,
      userRole: users.role,
    })
    .from(contestationMessages)
    .innerJoin(users, eq(contestationMessages.userId, users.id))
    .where(eq(contestationMessages.releaseId, releaseId))
    .orderBy(contestationMessages.createdAt);

  return messages.map((m) => ({
    id: m.id,
    releaseId: m.releaseId,
    senderName: m.userName,
    senderRole: m.userRole === 'user' ? ('user' as const) : ('admin' as const),
    message: m.message,
    createdAt: m.createdAt.toISOString(),
  }));
}

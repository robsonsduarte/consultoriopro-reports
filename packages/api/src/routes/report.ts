import { Hono } from 'hono';
import { eq, and } from 'drizzle-orm';
import { authMiddleware, type AuthEnv } from '../middleware/auth.js';
import { externalApi } from '../services/external-api.js';
import { db } from '../db/index.js';
import {
  shifts,
  reportReleases,
  contestationMessages,
  appointmentOverrides,
  users,
} from '../db/schema.js';

const report = new Hono<AuthEnv>();

// GET /report/:professionalId?month=YYYY-MM
report.get('/:professionalId', authMiddleware, async (c) => {
  const professionalId = Number(c.req.param('professionalId'));
  const month = c.req.query('month');
  const authUser = c.get('user');

  if (!professionalId || isNaN(professionalId)) {
    return c.json({ success: false, error: 'professionalId invalido' }, 400);
  }

  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return c.json({ success: false, error: 'Query param month obrigatorio (YYYY-MM)' }, 400);
  }

  // User can only see their own report
  if (authUser.role === 'user' && authUser.apiProfessionalId !== professionalId) {
    return c.json({ success: false, error: 'Permissao negada' }, 403);
  }

  // User can only see released reports
  if (authUser.role === 'user') {
    const [userRelease] = await db
      .select({ id: reportReleases.id })
      .from(reportReleases)
      .where(and(
        eq(reportReleases.professionalId, professionalId),
        eq(reportReleases.month, month),
      ))
      .limit(1);

    if (!userRelease) {
      return c.json({ success: false, error: 'Relatorio nao liberado' }, 403);
    }
  }

  // 1. External report (appointments + operators) e executions em paralelo
  const [externalReport, executions] = await Promise.all([
    externalApi.getReport(professionalId, month),
    externalApi.fetchExecutions(professionalId, month).catch((err: unknown) => {
      console.warn('[report] fetchExecutions falhou, continuando sem guideNumber:', err);
      return [];
    }),
  ]);

  // Monta indice de executions por "date|patientNormalizado" para match eficiente
  function normalizeName(name: string): string {
    return name.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').replace(/\s+/g, ' ').trim();
  }

  const executionIndex = new Map<string, string | null>();
  for (const exec of executions) {
    const key = `${exec.attendanceDay}|${normalizeName(exec.patientName)}`;
    // Se houver multiplas executions para mesma data+paciente, mantemos o primeiro guide_number nao-nulo
    if (!executionIndex.has(key) || executionIndex.get(key) === null) {
      executionIndex.set(key, exec.guideNumber);
    }
  }

  // 2. Appointment overrides (isPaid, isExcluded)
  const overrides = await db
    .select()
    .from(appointmentOverrides)
    .where(and(
      eq(appointmentOverrides.professionalId, professionalId),
      eq(appointmentOverrides.month, month),
    ));

  const overrideMap = new Map(overrides.map((o) => [o.externalAppointmentId, o]));

  // Merge overrides + guideNumber into appointments
  const appointments = externalReport.appointments
    .map((a) => {
      const override = overrideMap.get(Number(a.id));
      if (override?.isExcluded) return null;

      const lookupKey = `${a.date}|${normalizeName(a.patientName)}`;
      const guideNumber = executionIndex.has(lookupKey)
        ? (executionIndex.get(lookupKey) ?? null)
        : null;

      return {
        ...a,
        isPaid: override?.isPaid ?? a.isPaid,
        guideNumber,
      };
    })
    .filter((a): a is NonNullable<typeof a> => a !== null);

  // 3. Local shifts
  const localShifts = await db
    .select()
    .from(shifts)
    .where(and(
      eq(shifts.professionalId, professionalId),
      eq(shifts.month, month),
    ));

  // 4. Release + thread
  const [release] = await db
    .select()
    .from(reportReleases)
    .where(and(
      eq(reportReleases.professionalId, professionalId),
      eq(reportReleases.month, month),
    ))
    .limit(1);

  let thread: Array<{
    id: number;
    releaseId: number;
    senderName: string;
    senderRole: 'admin' | 'user';
    message: string;
    createdAt: string;
  }> = [];

  if (release) {
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
      .where(eq(contestationMessages.releaseId, release.id))
      .orderBy(contestationMessages.createdAt);

    thread = messages.map((m) => ({
      id: m.id,
      releaseId: m.releaseId,
      senderName: m.userName,
      senderRole: m.userRole === 'user' ? 'user' as const : 'admin' as const,
      message: m.message,
      createdAt: m.createdAt.toISOString(),
    }));
  }

  // 5. Calculate summary
  const revenue = appointments.reduce((sum, a) => sum + a.value, 0);
  const taxRate = externalReport.summary.taxRate;
  const tax = Math.round(revenue * (taxRate / 100) * 100) / 100;
  const shiftsValue = localShifts.reduce((sum, s) => sum + Number(s.shiftValue), 0);
  const netValue = Math.round((revenue - tax - shiftsValue) * 100) / 100;

  // Build response
  const data = {
    professional: externalReport.professional,
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
    operators: externalReport.operators,
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

  return c.json({ success: true, data });
});

export { report };

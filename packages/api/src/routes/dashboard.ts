import { Hono } from 'hono';
import { eq, and, sql } from 'drizzle-orm';
import { authMiddleware, requireRole, type AuthEnv } from '../middleware/auth.js';
import { externalApi } from '../services/external-api.js';
import { db } from '../db/index.js';
import { reportReleases, shifts, users } from '../db/schema.js';

const dashboard = new Hono<AuthEnv>();

// GET /dashboard/professionals?month=YYYY-MM
dashboard.get('/professionals', authMiddleware, requireRole('super_admin', 'admin'), async (c) => {
  const month = c.req.query('month');
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return c.json({ success: false, error: 'Query param month obrigatorio (YYYY-MM)' }, 400);
  }

  // Buscar profissionais ativos da tabela local (vinculados via apiProfessionalId)
  const activeUsers = await db
    .select({ apiProfessionalId: users.apiProfessionalId })
    .from(users)
    .where(and(eq(users.isActive, true), sql`${users.apiProfessionalId} IS NOT NULL`));

  const activeIds = new Set(activeUsers.map((u) => u.apiProfessionalId!));

  const allProfessionals = await externalApi.getProfessionals();
  const professionals = allProfessionals.filter((p) => activeIds.has(p.id));
  const ids = professionals.map((p) => p.id);

  // Batch fetch reports from external API (with snapshot cache)
  const reports = await externalApi.getReportBatch(ids, month);

  // Fetch local shifts totals per professional
  const shiftsData = await db
    .select({
      professionalId: shifts.professionalId,
      totalShifts: sql<number>`count(*)::int`,
      totalShiftsValue: sql<number>`coalesce(sum(${shifts.shiftValue}), 0)::numeric`,
    })
    .from(shifts)
    .where(eq(shifts.month, month))
    .groupBy(shifts.professionalId);

  const shiftsMap = new Map(shiftsData.map((s) => [s.professionalId, s]));

  // Fetch releases for this month
  const releases = await db
    .select()
    .from(reportReleases)
    .where(eq(reportReleases.month, month));

  const releaseMap = new Map(releases.map((r) => [r.professionalId, r]));

  // Build response
  const data = professionals.map((prof) => {
    const report = reports.get(prof.id);
    const shiftInfo = shiftsMap.get(prof.id);
    const release = releaseMap.get(prof.id);

    const revenue = report?.summary.revenue ?? 0;
    const tax = report?.summary.tax ?? 0;
    const shiftsCount = shiftInfo?.totalShifts ?? 0;
    const shiftsValue = Number(shiftInfo?.totalShiftsValue ?? 0);
    const netValue = Math.round((revenue - tax - shiftsValue) * 100) / 100;

    return {
      id: prof.id,
      name: prof.name,
      specialty: prof.specialty,
      revenue,
      tax,
      shifts: shiftsCount,
      netValue,
      status: release?.status ?? null,
      releaseId: release?.id ?? null,
      isPaid: release?.isPaid ?? false,
      month,
    };
  });

  return c.json({ success: true, data });
});

// GET /dashboard/my-releases — Historico de releases do profissional logado
dashboard.get('/my-releases', authMiddleware, async (c) => {
  const authUser = c.get('user');

  if (!authUser.apiProfessionalId) {
    return c.json({ success: false, error: 'Usuario nao vinculado a profissional' }, 400);
  }

  const professionalId = authUser.apiProfessionalId;

  // Buscar todas as releases deste profissional
  const releases = await db
    .select()
    .from(reportReleases)
    .where(eq(reportReleases.professionalId, professionalId))
    .orderBy(sql`${reportReleases.month} DESC`);

  if (releases.length === 0) {
    return c.json({ success: true, data: [] });
  }

  // Buscar report de cada mes em paralelo (snapshot cache torna rapido)
  const reportByMonth = new Map<string, { revenue: number; tax: number }>();
  const fetchPromises = releases.map(async (r) => {
    try {
      const report = await externalApi.getReport(professionalId, r.month);
      reportByMonth.set(r.month, { revenue: report.summary.revenue, tax: report.summary.tax });
    } catch {
      // Se falhar, fica com 0
    }
  });
  await Promise.all(fetchPromises);

  // Buscar shifts agrupados por mes
  const shiftsData = await db
    .select({
      month: shifts.month,
      totalShifts: sql<number>`count(*)::int`,
      totalShiftsValue: sql<number>`coalesce(sum(${shifts.shiftValue}), 0)::numeric`,
    })
    .from(shifts)
    .where(eq(shifts.professionalId, professionalId))
    .groupBy(shifts.month);

  const shiftsMap = new Map(shiftsData.map((s) => [s.month, s]));

  // Montar resposta
  const data = releases.map((r) => {
    const reportData = reportByMonth.get(r.month);
    const shiftInfo = shiftsMap.get(r.month);

    const revenue = reportData?.revenue ?? 0;
    const tax = reportData?.tax ?? 0;
    const shiftsCount = shiftInfo?.totalShifts ?? 0;
    const shiftsValue = Number(shiftInfo?.totalShiftsValue ?? 0);
    const netValue = Math.round((revenue - tax - shiftsValue) * 100) / 100;

    return {
      month: r.month,
      status: r.status,
      releaseId: r.id,
      isPaid: r.isPaid,
      revenue,
      tax,
      shifts: shiftsCount,
      netValue,
    };
  });

  return c.json({ success: true, data });
});

export { dashboard };

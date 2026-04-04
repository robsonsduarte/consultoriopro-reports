import { Hono } from 'hono';
import { eq, and, sql, inArray } from 'drizzle-orm';
import { authMiddleware, requireRole, type AuthEnv } from '../middleware/auth.js';
import { externalApi } from '../services/external-api.js';
import { db } from '../db/index.js';
import { reportReleases, shifts, users, professionalsMirror, reportSummaryMirror } from '../db/schema.js';

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

  // Buscar profissionais do mirror local (filtrados por users ativos)
  const activeIdsList = Array.from(activeIds);
  const mirrorProfessionals = activeIdsList.length > 0
    ? await db.select().from(professionalsMirror).where(inArray(professionalsMirror.externalId, activeIdsList))
    : [];

  // Fallback: se mirror vazio, usar API externa (pre-sync)
  if (mirrorProfessionals.length === 0) {
    const allProfessionals = await externalApi.getProfessionals();
    const professionals = allProfessionals.filter((p) => activeIds.has(p.id));
    const ids = professionals.map((p) => p.id);
    const reports = await externalApi.getReportBatch(ids, month);

    const shiftsDataFb = await db
      .select({
        professionalId: shifts.professionalId,
        totalShifts: sql<number>`count(*)::int`,
        totalShiftsValue: sql<number>`coalesce(sum(${shifts.shiftValue}), 0)::numeric`,
      })
      .from(shifts)
      .where(eq(shifts.month, month))
      .groupBy(shifts.professionalId);

    const shiftsMapFb = new Map(shiftsDataFb.map((s) => [s.professionalId, s]));

    const releasesFb = await db
      .select()
      .from(reportReleases)
      .where(eq(reportReleases.month, month));

    const releaseMapFb = new Map(releasesFb.map((r) => [r.professionalId, r]));

    const dataFb = professionals.map((prof) => {
      const report = reports.get(prof.id);
      const shiftInfo = shiftsMapFb.get(prof.id);
      const release = releaseMapFb.get(prof.id);

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
        shiftsValue: Math.round(shiftsValue * 100) / 100,
        netValue,
        status: release?.status ?? null,
        releaseId: release?.id ?? null,
        isPaid: release?.isPaid ?? false,
        month,
      };
    });

    dataFb.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
    return c.json({ success: true, data: dataFb });
  }

  // Mirror path — leitura local (< 100ms)
  const professionals = mirrorProfessionals
    .map((p) => ({ id: p.externalId, name: p.name, specialty: p.specialty }))
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  const ids = professionals.map((p) => p.id);

  // Buscar summaries do mirror
  const summaries = ids.length > 0
    ? await db.select().from(reportSummaryMirror).where(
        and(eq(reportSummaryMirror.month, month), inArray(reportSummaryMirror.professionalId, ids))
      )
    : [];
  const summaryMap = new Map(summaries.map((s) => [s.professionalId, s]));

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
    const summary = summaryMap.get(prof.id);
    const shiftInfo = shiftsMap.get(prof.id);
    const release = releaseMap.get(prof.id);

    const revenue = summary ? Number(summary.revenue) : 0;
    const tax = summary ? Number(summary.tax) : 0;
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
      shiftsValue: Math.round(shiftsValue * 100) / 100,
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

  // Buscar summaries do mirror local
  const months = releases.map((r) => r.month);
  const summaries = months.length > 0
    ? await db.select().from(reportSummaryMirror).where(
        and(eq(reportSummaryMirror.professionalId, professionalId), inArray(reportSummaryMirror.month, months))
      )
    : [];
  const reportByMonth = new Map(summaries.map((s) => [s.month, { revenue: Number(s.revenue), tax: Number(s.tax) }]));

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

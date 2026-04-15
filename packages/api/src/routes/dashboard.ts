import { Hono } from 'hono';
import { eq, and, sql, inArray } from 'drizzle-orm';
import { authMiddleware, requireRole, type AuthEnv } from '../middleware/auth.js';
import { externalApi } from '../services/external-api.js';
import { db } from '../db/index.js';
import { reportReleases, shifts, users, professionalsMirror, reportSummaryMirror, appointmentsMirror, appointmentOverrides, reportSnapshotAppointments } from '../db/schema.js';
import {
  getActiveSnapshot,
  buildDashboardFromSnapshot,
  type SnapshotMeta,
} from '../services/report-snapshots.service.js';

const dashboard = new Hono<AuthEnv>();

// GET /dashboard/professionals?month=YYYY-MM&source=live|snapshot
dashboard.get('/professionals', authMiddleware, requireRole('super_admin', 'admin'), async (c) => {
  const month = c.req.query('month');
  const sourceParam = c.req.query('source');
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return c.json({ success: false, error: 'Query param month obrigatorio (YYYY-MM)' }, 400);
  }

  // Decidir fonte: snapshot ativo (default) ou live
  const activeSnapshot = await getActiveSnapshot(month);
  const wantsLive = sourceParam === 'live';
  if (!wantsLive && activeSnapshot) {
    const data = buildDashboardFromSnapshot(activeSnapshot);
    // Releases sempre vem do live — status/isPaid podem ter mudado apos snapshot
    const releases = await db
      .select()
      .from(reportReleases)
      .where(eq(reportReleases.month, month));
    const releaseMap = new Map(releases.map((r) => [r.professionalId, r]));

    // Aplica overrides de exclusao: subtrai valor dos atendimentos excluidos
    // do revenue/tax/netValue congelados no snapshot.
    const snapshotProfIds = data.map((r) => r.id);
    const overrides = snapshotProfIds.length > 0
      ? await db.select().from(appointmentOverrides).where(and(
          eq(appointmentOverrides.month, month),
          inArray(appointmentOverrides.professionalId, snapshotProfIds),
        ))
      : [];
    const excludedByProf = new Map<number, Set<number>>();
    for (const o of overrides) {
      if (!o.isExcluded) continue;
      const set = excludedByProf.get(o.professionalId) ?? new Set<number>();
      set.add(o.externalAppointmentId);
      excludedByProf.set(o.professionalId, set);
    }

    const hasExclusions = Array.from(excludedByProf.values()).some((s) => s.size > 0);
    const excludedDeltaByProf = new Map<number, number>();
    if (hasExclusions) {
      const snapAppts = await db
        .select()
        .from(reportSnapshotAppointments)
        .where(eq(reportSnapshotAppointments.snapshotId, activeSnapshot.id));
      for (const a of snapAppts) {
        const excluded = excludedByProf.get(a.professionalId);
        if (!excluded?.has(a.externalAppointmentId)) continue;
        excludedDeltaByProf.set(
          a.professionalId,
          (excludedDeltaByProf.get(a.professionalId) ?? 0) + Number(a.value),
        );
      }
    }

    const merged = data.map((row) => {
      const release = releaseMap.get(row.id);
      const delta = excludedDeltaByProf.get(row.id) ?? 0;
      const origRevenue = row.revenue;
      const taxRate = origRevenue > 0 ? (row.tax / origRevenue) * 100 : 0;
      const revenue = Math.round((origRevenue - delta) * 100) / 100;
      const tax = Math.round(revenue * (taxRate / 100) * 100) / 100;
      const netValue = Math.round((revenue - tax - row.shiftsValue) * 100) / 100;
      return {
        ...row,
        revenue,
        tax,
        netValue,
        status: release?.status ?? row.status,
        releaseId: release?.id ?? row.releaseId,
        isPaid: release?.isPaid ?? row.isPaid,
      };
    });
    const meta: SnapshotMeta = {
      source: 'snapshot',
      snapshotId: activeSnapshot.id,
      version: activeSnapshot.version,
      name: activeSnapshot.name,
      createdAt: activeSnapshot.createdAt.toISOString(),
    };
    return c.json({ success: true, data: merged, meta });
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
    const metaFb: SnapshotMeta = { source: 'live' };
    return c.json({ success: true, data: dataFb, meta: metaFb });
  }

  // Mirror path — leitura local (< 100ms)
  const professionals = mirrorProfessionals
    .map((p) => ({ id: p.externalId, name: p.name, specialty: p.specialty }))
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  const ids = professionals.map((p) => p.id);

  // Buscar summaries do mirror (para taxRate)
  const summaries = ids.length > 0
    ? await db.select().from(reportSummaryMirror).where(
        and(eq(reportSummaryMirror.month, month), inArray(reportSummaryMirror.professionalId, ids))
      )
    : [];
  const summaryMap = new Map(summaries.map((s) => [s.professionalId, s]));

  // Buscar appointments do mirror para recalcular revenue respeitando exclusoes
  const allAppointments = ids.length > 0
    ? await db.select().from(appointmentsMirror).where(
        and(eq(appointmentsMirror.month, month), inArray(appointmentsMirror.professionalId, ids))
      )
    : [];

  // Buscar overrides de exclusao
  const allOverrides = ids.length > 0
    ? await db.select().from(appointmentOverrides).where(
        and(eq(appointmentOverrides.month, month), inArray(appointmentOverrides.professionalId, ids))
      )
    : [];
  const excludedSet = new Set(
    allOverrides.filter((o) => o.isExcluded).map((o) => `${o.externalAppointmentId}|${o.professionalId}`)
  );

  // Calcular revenue real por profissional (sem atendimentos excluidos)
  const revenueByProf = new Map<number, number>();
  for (const appt of allAppointments) {
    const key = `${appt.externalId}|${appt.professionalId}`;
    if (excludedSet.has(key)) continue;
    revenueByProf.set(appt.professionalId, (revenueByProf.get(appt.professionalId) ?? 0) + Number(appt.value));
  }

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

  // Build response (revenue recalculado a partir dos appointments, respeitando exclusoes)
  const data = professionals.map((prof) => {
    const summary = summaryMap.get(prof.id);
    const shiftInfo = shiftsMap.get(prof.id);
    const release = releaseMap.get(prof.id);

    const revenue = Math.round((revenueByProf.get(prof.id) ?? 0) * 100) / 100;
    const taxRate = summary ? Number(summary.taxRate) : 15;
    const tax = Math.round(revenue * (taxRate / 100) * 100) / 100;
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

  const meta: SnapshotMeta = { source: 'live' };
  return c.json({ success: true, data, meta });
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

  // Buscar summaries do mirror local (para taxRate)
  const months = releases.map((r) => r.month);
  const summariesMR = months.length > 0
    ? await db.select().from(reportSummaryMirror).where(
        and(eq(reportSummaryMirror.professionalId, professionalId), inArray(reportSummaryMirror.month, months))
      )
    : [];
  const taxRateByMonth = new Map(summariesMR.map((s) => [s.month, Number(s.taxRate)]));

  // Buscar appointments do mirror para recalcular revenue respeitando exclusoes
  const myAppointments = months.length > 0
    ? await db.select().from(appointmentsMirror).where(
        and(eq(appointmentsMirror.professionalId, professionalId), inArray(appointmentsMirror.month, months))
      )
    : [];

  // Buscar overrides de exclusao
  const myOverrides = months.length > 0
    ? await db.select().from(appointmentOverrides).where(
        and(eq(appointmentOverrides.professionalId, professionalId), inArray(appointmentOverrides.month, months))
      )
    : [];
  const myExcludedSet = new Set(
    myOverrides.filter((o) => o.isExcluded).map((o) => `${o.externalAppointmentId}|${o.month}`)
  );

  // Calcular revenue real por mes (sem atendimentos excluidos)
  const revenueByMonth = new Map<string, number>();
  for (const appt of myAppointments) {
    const key = `${appt.externalId}|${appt.month}`;
    if (myExcludedSet.has(key)) continue;
    revenueByMonth.set(appt.month, (revenueByMonth.get(appt.month) ?? 0) + Number(appt.value));
  }

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

  // Montar resposta (revenue recalculado a partir dos appointments, respeitando exclusoes)
  const data = releases.map((r) => {
    const shiftInfo = shiftsMap.get(r.month);

    const revenue = Math.round((revenueByMonth.get(r.month) ?? 0) * 100) / 100;
    const taxRate = taxRateByMonth.get(r.month) ?? 15;
    const tax = Math.round(revenue * (taxRate / 100) * 100) / 100;
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

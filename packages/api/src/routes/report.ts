import { Hono } from 'hono';
import { eq, and } from 'drizzle-orm';
import { authMiddleware, type AuthEnv } from '../middleware/auth.js';
import { db } from '../db/index.js';
import { reportReleases } from '../db/schema.js';
import {
  buildLiveProfessionalReport,
  fetchThread,
} from '../services/report-live.service.js';
import {
  getActiveSnapshot,
  buildProfessionalFromSnapshot,
  type SnapshotMeta,
} from '../services/report-snapshots.service.js';

const report = new Hono<AuthEnv>();

// GET /report/:professionalId?month=YYYY-MM&source=live|snapshot
report.get('/:professionalId', authMiddleware, async (c) => {
  const professionalId = Number(c.req.param('professionalId'));
  const month = c.req.query('month');
  const sourceParam = c.req.query('source');
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

  // Decidir fonte: live ou snapshot
  const activeSnapshot = await getActiveSnapshot(month);
  const wantsLive = sourceParam === 'live';
  const useSnapshot = !wantsLive && activeSnapshot !== null;

  if (useSnapshot && activeSnapshot) {
    try {
      const fromSnapshot = await buildProfessionalFromSnapshot(activeSnapshot, professionalId);

      // Release/thread sempre vem do live — nao congelam
      const [release] = await db
        .select()
        .from(reportReleases)
        .where(and(
          eq(reportReleases.professionalId, professionalId),
          eq(reportReleases.month, month),
        ))
        .limit(1);

      const thread = release ? await fetchThread(release.id) : [];

      const meta: SnapshotMeta = {
        source: 'snapshot',
        snapshotId: activeSnapshot.id,
        version: activeSnapshot.version,
        name: activeSnapshot.name,
        createdAt: activeSnapshot.createdAt.toISOString(),
      };

      return c.json({
        success: true,
        data: {
          ...fromSnapshot,
          release: release
            ? { id: release.id, status: release.status, isPaid: release.isPaid }
            : null,
          thread,
          meta,
        },
      });
    } catch (err) {
      // Se o profissional nao existe no snapshot (adicionado depois), cai para live
      console.warn('[report] Fallback live — profissional ausente do snapshot:', err);
    }
  }

  const liveData = await buildLiveProfessionalReport(professionalId, month);
  const meta: SnapshotMeta = { source: 'live' };

  return c.json({ success: true, data: { ...liveData, meta } });
});

export { report };

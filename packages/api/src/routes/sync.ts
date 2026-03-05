import { Hono } from 'hono';
import {
  authMiddleware,
  requireRole,
  type AuthEnv,
} from '../middleware/auth.js';
import {
  syncProfessionals,
  syncAllReports,
  syncSingleReport,
  getSyncStatus,
  getSyncProgress,
} from '../services/sync-worker.js';

const syncRouter = new Hono<AuthEnv>();

// GET /sync/status — ultimo sync, profissionais sincronizados, jobs ativos
syncRouter.get(
  '/status',
  authMiddleware,
  requireRole('super_admin', 'admin'),
  async (c) => {
    const status = await getSyncStatus();
    return c.json({ success: true, data: status });
  },
);

// POST /sync/trigger — dispara sync manual
syncRouter.post(
  '/trigger',
  authMiddleware,
  requireRole('super_admin', 'admin'),
  async (c) => {
    const month = c.req.query('month');
    const professionalIdStr = c.req.query('professionalId');

    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return c.json(
        { success: false, error: 'Query param month obrigatorio (YYYY-MM)' },
        400,
      );
    }

    // Sync individual (rapido, sincrono)
    if (professionalIdStr) {
      const professionalId = Number(professionalIdStr);
      if (isNaN(professionalId)) {
        return c.json(
          { success: false, error: 'professionalId invalido' },
          400,
        );
      }
      await syncSingleReport(professionalId, month);
      return c.json({
        success: true,
        data: { type: 'single', professionalId, month },
      });
    }

    // Sync de todos (assincrono, retorna jobId)
    await syncProfessionals();
    const jobId = await syncAllReports(month);
    return c.json({ success: true, data: { type: 'all', jobId, month } });
  },
);

// GET /sync/progress/:jobId — progresso de um sync em andamento
syncRouter.get(
  '/progress/:jobId',
  authMiddleware,
  requireRole('super_admin', 'admin'),
  async (c) => {
    const jobId = c.req.param('jobId');
    const progress = getSyncProgress(jobId);

    if (!progress) {
      return c.json({ success: false, error: 'Job nao encontrado' }, 404);
    }

    return c.json({ success: true, data: progress });
  },
);

export { syncRouter };

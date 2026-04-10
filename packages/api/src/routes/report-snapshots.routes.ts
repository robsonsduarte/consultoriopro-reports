import { Hono } from 'hono';
import { authMiddleware, requireRole, type AuthEnv } from '../middleware/auth.js';
import {
  saveSnapshot,
  listSnapshots,
  restoreSnapshot,
  deleteSnapshot,
} from '../services/report-snapshots.service.js';

const snapshots = new Hono<AuthEnv>();

// POST /snapshots  { month: "YYYY-MM" }
snapshots.post('/', authMiddleware, requireRole('super_admin', 'admin'), async (c) => {
  const body = await c.req.json().catch(() => ({} as { month?: string }));
  const month = body.month;

  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return c.json({ success: false, error: 'Body.month obrigatorio (YYYY-MM)' }, 400);
  }

  const user = c.get('user');

  try {
    const snap = await saveSnapshot(month, user.id);
    return c.json({
      success: true,
      data: {
        id: snap.id,
        month: snap.month,
        version: snap.version,
        name: snap.name,
        isActive: snap.isActive,
        createdBy: snap.createdBy,
        createdAt: snap.createdAt.toISOString(),
      },
    });
  } catch (err) {
    console.error('[snapshots] saveSnapshot falhou:', err);
    const message = err instanceof Error ? err.message : 'Erro ao salvar snapshot';
    return c.json({ success: false, error: message }, 500);
  }
});

// GET /snapshots?month=YYYY-MM
snapshots.get('/', authMiddleware, requireRole('super_admin', 'admin'), async (c) => {
  const month = c.req.query('month');
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return c.json({ success: false, error: 'Query param month obrigatorio (YYYY-MM)' }, 400);
  }

  const rows = await listSnapshots(month);
  return c.json({
    success: true,
    data: rows.map((r) => ({
      id: r.id,
      month: r.month,
      version: r.version,
      name: r.name,
      isActive: r.isActive,
      createdBy: r.createdBy,
      createdAt: r.createdAt.toISOString(),
    })),
  });
});

// POST /snapshots/:id/restore
snapshots.post('/:id/restore', authMiddleware, requireRole('super_admin', 'admin'), async (c) => {
  const id = Number(c.req.param('id'));
  if (!id || isNaN(id)) {
    return c.json({ success: false, error: 'id invalido' }, 400);
  }

  try {
    const restored = await restoreSnapshot(id);
    return c.json({
      success: true,
      data: {
        id: restored.id,
        month: restored.month,
        version: restored.version,
        name: restored.name,
        isActive: restored.isActive,
        createdBy: restored.createdBy,
        createdAt: restored.createdAt.toISOString(),
      },
    });
  } catch (err) {
    console.error('[snapshots] restoreSnapshot falhou:', err);
    const message = err instanceof Error ? err.message : 'Erro ao restaurar snapshot';
    return c.json({ success: false, error: message }, 500);
  }
});

// DELETE /snapshots/:id
snapshots.delete('/:id', authMiddleware, requireRole('super_admin', 'admin'), async (c) => {
  const id = Number(c.req.param('id'));
  if (!id || isNaN(id)) {
    return c.json({ success: false, error: 'id invalido' }, 400);
  }

  try {
    await deleteSnapshot(id);
    return c.json({ success: true, data: null });
  } catch (err) {
    console.error('[snapshots] deleteSnapshot falhou:', err);
    const message = err instanceof Error ? err.message : 'Erro ao deletar snapshot';
    const isBadRequest = message.includes('versao ativa');
    return c.json({ success: false, error: message }, isBadRequest ? 400 : 500);
  }
});

export { snapshots };

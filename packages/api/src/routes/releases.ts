import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import { authMiddleware, requireRole, type AuthEnv } from '../middleware/auth.js';
import { db } from '../db/index.js';
import { reportReleases, contestationMessages, users } from '../db/schema.js';
import { externalApi } from '../services/external-api.js';

function formatRelease(r: typeof reportReleases.$inferSelect) {
  return {
    id: r.id,
    professionalId: r.professionalId,
    month: r.month,
    status: r.status,
    isPaid: r.isPaid,
    releasedBy: r.releasedBy,
    respondedAt: r.respondedAt?.toISOString() ?? null,
    createdAt: r.createdAt.toISOString(),
  };
}

const releasesRouter = new Hono<AuthEnv>();

// POST /releases — Create release
releasesRouter.post('/', authMiddleware, requireRole('super_admin', 'admin'), async (c) => {
  const body = await c.req.json() as { professionalId: number; month: string };
  const authUser = c.get('user');

  if (!body.professionalId || !body.month) {
    return c.json({ success: false, error: 'Campos obrigatorios: professionalId, month' }, 400);
  }

  if (!/^\d{4}-\d{2}$/.test(body.month)) {
    return c.json({ success: false, error: 'Formato de month invalido (YYYY-MM)' }, 400);
  }

  const [created] = await db
    .insert(reportReleases)
    .values({
      professionalId: body.professionalId,
      month: body.month,
      status: 'pending',
      releasedBy: authUser.id,
    })
    .onConflictDoUpdate({
      target: [reportReleases.professionalId, reportReleases.month],
      set: {
        status: 'pending',
        releasedBy: authUser.id,
        respondedAt: null,
        isPaid: false,
        updatedAt: new Date(),
      },
    })
    .returning();

  return c.json({ success: true, data: formatRelease(created!) }, 201);
});

// POST /releases/batch — Batch release all for a month
releasesRouter.post('/batch', authMiddleware, requireRole('super_admin', 'admin'), async (c) => {
  const body = await c.req.json() as { month: string };
  const authUser = c.get('user');

  if (!body.month || !/^\d{4}-\d{2}$/.test(body.month)) {
    return c.json({ success: false, error: 'month obrigatorio (YYYY-MM)' }, 400);
  }

  const professionals = await externalApi.getProfessionals();

  // Get existing releases for this month
  const existingReleases = await db
    .select()
    .from(reportReleases)
    .where(eq(reportReleases.month, body.month));

  const existingProfIds = new Set(existingReleases.map((r) => r.professionalId));

  let created = 0;

  for (const prof of professionals) {
    if (existingProfIds.has(prof.id)) continue;

    await db.insert(reportReleases).values({
      professionalId: prof.id,
      month: body.month,
      status: 'pending',
      releasedBy: authUser.id,
    });

    created++;
  }

  return c.json({
    success: true,
    data: { created, total: professionals.length },
  });
});

// PATCH /releases/:id/revoke — Revoke (delete release + messages)
releasesRouter.patch('/:id/revoke', authMiddleware, requireRole('super_admin', 'admin'), async (c) => {
  const id = Number(c.req.param('id'));
  if (!id || isNaN(id)) {
    return c.json({ success: false, error: 'id invalido' }, 400);
  }

  // Delete contestation messages first (FK constraint)
  await db
    .delete(contestationMessages)
    .where(eq(contestationMessages.releaseId, id));

  const [deleted] = await db
    .delete(reportReleases)
    .where(eq(reportReleases.id, id))
    .returning();

  if (!deleted) {
    return c.json({ success: false, error: 'Release nao encontrada' }, 404);
  }

  return c.json({ success: true, data: { revoked: true } });
});

// PATCH /releases/:id/approve — Professional approves
releasesRouter.patch('/:id/approve', authMiddleware, async (c) => {
  const id = Number(c.req.param('id'));
  if (!id || isNaN(id)) {
    return c.json({ success: false, error: 'id invalido' }, 400);
  }

  const authUser = c.get('user');

  // Get the release
  const [release] = await db
    .select()
    .from(reportReleases)
    .where(eq(reportReleases.id, id))
    .limit(1);

  if (!release) {
    return c.json({ success: false, error: 'Release nao encontrada' }, 404);
  }

  // Check permission: admin or professional owner
  const isAdmin = authUser.role === 'super_admin' || authUser.role === 'admin';
  const isOwner = authUser.apiProfessionalId === release.professionalId;

  if (!isAdmin && !isOwner) {
    return c.json({ success: false, error: 'Permissao negada' }, 403);
  }

  const [updated] = await db
    .update(reportReleases)
    .set({
      status: 'approved',
      respondedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(reportReleases.id, id))
    .returning();

  return c.json({ success: true, data: formatRelease(updated!) });
});

// PATCH /releases/:id/contest — Professional contests
releasesRouter.patch('/:id/contest', authMiddleware, async (c) => {
  const id = Number(c.req.param('id'));
  if (!id || isNaN(id)) {
    return c.json({ success: false, error: 'id invalido' }, 400);
  }

  const body = await c.req.json() as { message: string };
  const authUser = c.get('user');

  if (!body.message || !body.message.trim()) {
    return c.json({ success: false, error: 'Mensagem obrigatoria' }, 400);
  }

  const [release] = await db
    .select()
    .from(reportReleases)
    .where(eq(reportReleases.id, id))
    .limit(1);

  if (!release) {
    return c.json({ success: false, error: 'Release nao encontrada' }, 404);
  }

  // Update status to contested
  const [updated] = await db
    .update(reportReleases)
    .set({ status: 'contested', updatedAt: new Date() })
    .where(eq(reportReleases.id, id))
    .returning();

  // Create contestation message
  await db.insert(contestationMessages).values({
    releaseId: id,
    userId: authUser.id,
    message: body.message.trim(),
  });

  return c.json({ success: true, data: formatRelease(updated!) });
});

// PATCH /releases/:id/resolve — Admin resolves contestation
releasesRouter.patch('/:id/resolve', authMiddleware, requireRole('super_admin', 'admin'), async (c) => {
  const id = Number(c.req.param('id'));
  if (!id || isNaN(id)) {
    return c.json({ success: false, error: 'id invalido' }, 400);
  }

  const [updated] = await db
    .update(reportReleases)
    .set({
      status: 'resolved',
      respondedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(reportReleases.id, id))
    .returning();

  if (!updated) {
    return c.json({ success: false, error: 'Release nao encontrada' }, 404);
  }

  return c.json({ success: true, data: formatRelease(updated) });
});

// PATCH /releases/:id/pay — Mark as paid
releasesRouter.patch('/:id/pay', authMiddleware, requireRole('super_admin', 'admin'), async (c) => {
  const id = Number(c.req.param('id'));
  if (!id || isNaN(id)) {
    return c.json({ success: false, error: 'id invalido' }, 400);
  }

  const [updated] = await db
    .update(reportReleases)
    .set({ isPaid: true, updatedAt: new Date() })
    .where(eq(reportReleases.id, id))
    .returning();

  if (!updated) {
    return c.json({ success: false, error: 'Release nao encontrada' }, 404);
  }

  return c.json({ success: true, data: formatRelease(updated) });
});

// POST /releases/:id/messages — Send message in thread
releasesRouter.post('/:id/messages', authMiddleware, async (c) => {
  const id = Number(c.req.param('id'));
  if (!id || isNaN(id)) {
    return c.json({ success: false, error: 'id invalido' }, 400);
  }

  const body = await c.req.json() as { message: string };
  const authUser = c.get('user');

  if (!body.message || !body.message.trim()) {
    return c.json({ success: false, error: 'Mensagem obrigatoria' }, 400);
  }

  // Check release exists
  const [release] = await db
    .select()
    .from(reportReleases)
    .where(eq(reportReleases.id, id))
    .limit(1);

  if (!release) {
    return c.json({ success: false, error: 'Release nao encontrada' }, 404);
  }

  // If user is 'user' role and release is 'contested', set to 'in_review'
  if (authUser.role === 'user' && release.status === 'contested') {
    await db
      .update(reportReleases)
      .set({ status: 'in_review', updatedAt: new Date() })
      .where(eq(reportReleases.id, id));
  }

  // Create message
  const [message] = await db
    .insert(contestationMessages)
    .values({
      releaseId: id,
      userId: authUser.id,
      message: body.message.trim(),
    })
    .returning();

  // Get sender info
  const [sender] = await db
    .select({ name: users.name, role: users.role })
    .from(users)
    .where(eq(users.id, authUser.id))
    .limit(1);

  return c.json({
    success: true,
    data: {
      id: message!.id,
      releaseId: message!.releaseId,
      senderName: sender?.name ?? authUser.name,
      senderRole: sender?.role === 'user' ? 'user' : 'admin',
      message: message!.message,
      createdAt: message!.createdAt.toISOString(),
    },
  }, 201);
});

export { releasesRouter };

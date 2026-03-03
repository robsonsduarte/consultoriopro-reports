import { Hono } from 'hono';
import { eq, sql } from 'drizzle-orm';
import { authMiddleware, type AuthEnv } from '../middleware/auth.js';
import { db } from '../db/index.js';
import { contestationMessages, reportReleases, users } from '../db/schema.js';

const notifications = new Hono<AuthEnv>();

// GET /notifications/unread — Mensagens nao lidas do usuario logado
notifications.get('/unread', authMiddleware, async (c) => {
  const authUser = c.get('user');
  const userId = authUser.id;
  const isAdmin = authUser.role === 'super_admin' || authUser.role === 'admin';

  // Buscar mensagens nao lidas pelo usuario atual, excluindo proprias mensagens
  // NOT (userId = ANY(read_by_user_ids)) AND user_id != authUser.id
  const unreadMessages = await db
    .select({
      id: contestationMessages.id,
      releaseId: contestationMessages.releaseId,
      message: contestationMessages.message,
      createdAt: contestationMessages.createdAt,
      senderId: contestationMessages.userId,
      senderName: users.name,
      releaseProfessionalId: reportReleases.professionalId,
      releaseMonth: reportReleases.month,
    })
    .from(contestationMessages)
    .innerJoin(reportReleases, eq(contestationMessages.releaseId, reportReleases.id))
    .innerJoin(users, eq(contestationMessages.userId, users.id))
    .where(sql`${contestationMessages.userId} != ${userId} AND NOT (${userId} = ANY(${contestationMessages.readByUserIds}))`)
    .orderBy(sql`${contestationMessages.createdAt} DESC`);

  // Filtrar: user so ve mensagens de seus proprios releases
  const filtered = isAdmin
    ? unreadMessages
    : unreadMessages.filter((m) => m.releaseProfessionalId === authUser.apiProfessionalId);

  if (filtered.length === 0) {
    return c.json({ success: true, data: { totalUnread: 0, releases: [] } });
  }

  // Agrupar por releaseId
  const releaseMap = new Map<number, {
    releaseId: number;
    professionalId: number;
    month: string;
    unreadCount: number;
    lastMessage: string;
    lastMessageAt: string;
    senderName: string;
  }>();

  for (const msg of filtered) {
    const existing = releaseMap.get(msg.releaseId);
    if (!existing) {
      releaseMap.set(msg.releaseId, {
        releaseId: msg.releaseId,
        professionalId: msg.releaseProfessionalId,
        month: msg.releaseMonth,
        unreadCount: 1,
        lastMessage: msg.message.slice(0, 100),
        lastMessageAt: msg.createdAt.toISOString(),
        senderName: msg.senderName,
      });
    } else {
      existing.unreadCount++;
    }
  }

  const releases = Array.from(releaseMap.values());

  return c.json({
    success: true,
    data: {
      totalUnread: filtered.length,
      releases,
    },
  });
});

// PATCH /notifications/mark-read — Marca mensagens de um release como lidas
notifications.patch('/mark-read', authMiddleware, async (c) => {
  const authUser = c.get('user');
  const userId = authUser.id;
  const body = await c.req.json() as { releaseId: number };

  if (!body.releaseId) {
    return c.json({ success: false, error: 'releaseId obrigatorio' }, 400);
  }

  // Adicionar userId ao array read_by_user_ids onde ainda nao esta
  const result = await db.execute(
    sql`UPDATE contestation_messages SET read_by_user_ids = array_append(read_by_user_ids, ${userId}) WHERE release_id = ${body.releaseId} AND NOT (${userId} = ANY(read_by_user_ids))`,
  ) as unknown as { rowCount: number };

  return c.json({
    success: true,
    data: { marked: result.rowCount ?? 0 },
  });
});

export { notifications };

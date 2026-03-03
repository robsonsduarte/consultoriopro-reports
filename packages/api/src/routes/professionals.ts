import { Hono } from 'hono';
import { and, eq, sql } from 'drizzle-orm';
import { authMiddleware, requireRole, type AuthEnv } from '../middleware/auth.js';
import { externalApi } from '../services/external-api.js';
import { db } from '../db/index.js';
import { users } from '../db/schema.js';

const professionals = new Hono<AuthEnv>();

// GET /professionals — lista de profissionais ativos (admin)
professionals.get('/', authMiddleware, requireRole('super_admin', 'admin'), async (c) => {
  const activeUsers = await db
    .select({ apiProfessionalId: users.apiProfessionalId })
    .from(users)
    .where(and(eq(users.isActive, true), sql`${users.apiProfessionalId} IS NOT NULL`));

  const activeIds = new Set(activeUsers.map((u) => u.apiProfessionalId!));

  const list = await externalApi.getProfessionals();
  const filtered = list.filter((p) => activeIds.has(p.id));

  return c.json({ success: true, data: filtered });
});

export { professionals };

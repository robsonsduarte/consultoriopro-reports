import { Hono } from 'hono';
import { and, eq, sql, inArray } from 'drizzle-orm';
import { authMiddleware, requireRole, type AuthEnv } from '../middleware/auth.js';
import { externalApi } from '../services/external-api.js';
import { db } from '../db/index.js';
import { users, professionalsMirror } from '../db/schema.js';

const professionals = new Hono<AuthEnv>();

// GET /professionals — lista de profissionais ativos (admin)
professionals.get('/', authMiddleware, requireRole('super_admin', 'admin'), async (c) => {
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
    const list = await externalApi.getProfessionals();
    const filtered = list
      .filter((p) => activeIds.has(p.id))
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
    return c.json({ success: true, data: filtered });
  }

  const filtered = mirrorProfessionals
    .map((p) => ({ id: p.externalId, name: p.name, specialty: p.specialty }))
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  return c.json({ success: true, data: filtered });
});

export { professionals };

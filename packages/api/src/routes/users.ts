import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'node:crypto';
import { authMiddleware, requireRole, type AuthEnv } from '../middleware/auth.js';
import { db } from '../db/index.js';
import { users } from '../db/schema.js';
import { externalApi } from '../services/external-api.js';

const BCRYPT_ROUNDS = 12;

function generateTempPassword(): string {
  return randomBytes(4).toString('hex');
}

function formatUser(u: typeof users.$inferSelect) {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    apiProfessionalId: u.apiProfessionalId,
    isActive: u.isActive,
    mustChangePassword: u.mustChangePassword,
    createdAt: u.createdAt.toISOString(),
  };
}

const usersRouter = new Hono<AuthEnv>();

// GET /users — List all users
usersRouter.get('/', authMiddleware, requireRole('super_admin', 'admin'), async (c) => {
  const rows = await db.select().from(users).orderBy(users.name);

  // Lookup professional names from external API
  let professionalsMap = new Map<number, string>();
  try {
    const professionals = await externalApi.getProfessionals();
    professionalsMap = new Map(professionals.map((p) => [p.id, p.name]));
  } catch {
    // If external API fails, just skip professional names
  }

  const data = rows.map((u) => ({
    ...formatUser(u),
    professionalName: u.apiProfessionalId
      ? professionalsMap.get(u.apiProfessionalId) ?? null
      : null,
  }));

  return c.json({ success: true, data });
});

// POST /users — Create user
usersRouter.post('/', authMiddleware, requireRole('super_admin', 'admin'), async (c) => {
  const body = await c.req.json() as {
    name: string;
    email: string;
    password: string;
    role: 'super_admin' | 'admin' | 'user';
    apiProfessionalId?: number;
  };

  const authUser = c.get('user');

  // Admin nao pode criar super_admin
  if (authUser.role === 'admin' && body.role === 'super_admin') {
    return c.json({ success: false, error: 'Apenas super_admin pode criar usuarios super_admin' }, 403);
  }

  if (!body.email || !body.email.trim()) {
    return c.json({ success: false, error: 'Email obrigatorio' }, 400);
  }

  if (!body.password || body.password.length < 6) {
    return c.json({ success: false, error: 'Senha deve ter no minimo 6 caracteres' }, 400);
  }

  if (!body.name || !body.name.trim()) {
    return c.json({ success: false, error: 'Nome obrigatorio' }, 400);
  }

  // Check for duplicate email
  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, body.email.trim()))
    .limit(1);

  if (existing) {
    return c.json({ success: false, error: 'Email ja cadastrado' }, 409);
  }

  const passwordHash = await bcrypt.hash(body.password, BCRYPT_ROUNDS);

  const [created] = await db
    .insert(users)
    .values({
      name: body.name.trim(),
      email: body.email.trim(),
      passwordHash,
      role: body.role ?? 'user',
      apiProfessionalId: body.apiProfessionalId ?? null,
      isActive: true,
      mustChangePassword: true,
    })
    .returning();

  return c.json({ success: true, data: formatUser(created!) }, 201);
});

// PUT /users/:id — Update user
usersRouter.put('/:id', authMiddleware, requireRole('super_admin', 'admin'), async (c) => {
  const id = Number(c.req.param('id'));
  if (!id || isNaN(id)) {
    return c.json({ success: false, error: 'id invalido' }, 400);
  }

  const authUser = c.get('user');

  const body = await c.req.json() as {
    name?: string;
    email?: string;
    password?: string;
    role?: 'super_admin' | 'admin' | 'user';
    apiProfessionalId?: number | null;
    isActive?: boolean;
  };

  // Admin nao pode editar super_admin nem promover para super_admin
  if (authUser.role === 'admin') {
    const [target] = await db.select({ role: users.role }).from(users).where(eq(users.id, id)).limit(1);
    if (target?.role === 'super_admin') {
      return c.json({ success: false, error: 'Admin nao pode editar um super_admin' }, 403);
    }
    if (body.role === 'super_admin') {
      return c.json({ success: false, error: 'Apenas super_admin pode atribuir role super_admin' }, 403);
    }
  }

  const updateData: Record<string, unknown> = {};

  if (body.name !== undefined) updateData.name = body.name.trim();
  if (body.email !== undefined) updateData.email = body.email.trim();
  if (body.role !== undefined) updateData.role = body.role;
  if (body.apiProfessionalId !== undefined) updateData.apiProfessionalId = body.apiProfessionalId;
  if (body.isActive !== undefined) updateData.isActive = body.isActive;

  if (body.password && body.password.length > 0) {
    if (body.password.length < 6) {
      return c.json({ success: false, error: 'Senha deve ter no minimo 6 caracteres' }, 400);
    }
    updateData.passwordHash = await bcrypt.hash(body.password, BCRYPT_ROUNDS);
    updateData.mustChangePassword = true;
  }

  if (Object.keys(updateData).length === 0) {
    return c.json({ success: false, error: 'Nenhum campo para atualizar' }, 400);
  }

  updateData.updatedAt = new Date();

  const [updated] = await db
    .update(users)
    .set(updateData)
    .where(eq(users.id, id))
    .returning();

  if (!updated) {
    return c.json({ success: false, error: 'Usuario nao encontrado' }, 404);
  }

  return c.json({ success: true, data: formatUser(updated) });
});

// DELETE /users/:id — Soft delete (deactivate)
usersRouter.delete('/:id', authMiddleware, requireRole('super_admin', 'admin'), async (c) => {
  const id = Number(c.req.param('id'));
  if (!id || isNaN(id)) {
    return c.json({ success: false, error: 'id invalido' }, 400);
  }

  const authUser = c.get('user');
  if (authUser.id === id) {
    return c.json({ success: false, error: 'Nao e possivel desativar seu proprio usuario' }, 400);
  }

  // Admin nao pode excluir super_admin
  if (authUser.role === 'admin') {
    const [target] = await db.select({ role: users.role }).from(users).where(eq(users.id, id)).limit(1);
    if (target?.role === 'super_admin') {
      return c.json({ success: false, error: 'Admin nao pode excluir um super_admin' }, 403);
    }
  }

  const [updated] = await db
    .update(users)
    .set({ isActive: false, updatedAt: new Date() })
    .where(eq(users.id, id))
    .returning();

  if (!updated) {
    return c.json({ success: false, error: 'Usuario nao encontrado' }, 404);
  }

  return c.json({ success: true, data: { deactivated: true } });
});

// POST /users/:id/reset-password — Reset to temporary password
usersRouter.post('/:id/reset-password', authMiddleware, requireRole('super_admin', 'admin'), async (c) => {
  const id = Number(c.req.param('id'));
  if (!id || isNaN(id)) {
    return c.json({ success: false, error: 'id invalido' }, 400);
  }

  // Admin nao pode resetar senha de super_admin
  const authUser = c.get('user');
  if (authUser.role === 'admin') {
    const [target] = await db.select({ role: users.role }).from(users).where(eq(users.id, id)).limit(1);
    if (target?.role === 'super_admin') {
      return c.json({ success: false, error: 'Admin nao pode resetar senha de um super_admin' }, 403);
    }
  }

  const tempPassword = generateTempPassword();
  const passwordHash = await bcrypt.hash(tempPassword, BCRYPT_ROUNDS);

  const [updated] = await db
    .update(users)
    .set({
      passwordHash,
      mustChangePassword: true,
      updatedAt: new Date(),
    })
    .where(eq(users.id, id))
    .returning();

  if (!updated) {
    return c.json({ success: false, error: 'Usuario nao encontrado' }, 404);
  }

  return c.json({ success: true, data: { tempPassword } });
});

// POST /users/sync-professionals — Sync from external API
usersRouter.post('/sync-professionals', authMiddleware, requireRole('super_admin', 'admin'), async (c) => {
  const professionals = await externalApi.getProfessionals();

  // Get all existing users with apiProfessionalId
  const existingUsers = await db.select().from(users);
  const existingProfIds = new Set(
    existingUsers
      .filter((u) => u.apiProfessionalId !== null)
      .map((u) => u.apiProfessionalId!)
  );

  let created = 0;

  for (const prof of professionals) {
    if (existingProfIds.has(prof.id)) continue;

    const tempPassword = generateTempPassword();
    const passwordHash = await bcrypt.hash(tempPassword, BCRYPT_ROUNDS);

    await db.insert(users).values({
      name: prof.name,
      email: `prof${prof.id}@consultoriopro.com`,
      passwordHash,
      role: 'user',
      apiProfessionalId: prof.id,
      isActive: false,
      mustChangePassword: true,
    });

    created++;
  }

  return c.json({
    success: true,
    data: { created, total: professionals.length },
  });
});

export { usersRouter };

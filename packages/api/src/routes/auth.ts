import { Hono } from 'hono';
import jwt from 'jsonwebtoken';
const { sign } = jwt;
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { users } from '../db/schema.js';
import { loginSchema, changePasswordSchema } from '@cpro/shared';
import { authMiddleware, type AuthEnv } from '../middleware/auth.js';
import { createHash, randomBytes } from 'node:crypto';
import type { StringValue } from 'ms';

const JWT_SECRET = process.env.JWT_SECRET ?? 'cpro-dev-secret-change-in-production';
const JWT_EXPIRES_IN = (process.env.JWT_EXPIRES_IN ?? '4h') as StringValue;

function hashPassword(password: string): string {
  return createHash('sha256').update(password).digest('hex');
}

const auth = new Hono<AuthEnv>();

auth.post('/login', async (c) => {
  const body = await c.req.json();
  const parsed = loginSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ success: false, error: parsed.error.errors[0]?.message }, 400);
  }

  const { email, password } = parsed.data;

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (!user || !user.isActive) {
    return c.json({ success: false, error: 'Credenciais invalidas' }, 401);
  }

  const passwordHash = hashPassword(password);

  if (user.passwordHash !== passwordHash) {
    return c.json({ success: false, error: 'Credenciais invalidas' }, 401);
  }

  const payload = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    apiProfessionalId: user.apiProfessionalId,
  };

  const accessToken = sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

  return c.json({
    success: true,
    data: {
      user: payload,
      accessToken,
      mustChangePassword: user.mustChangePassword,
    },
  });
});

// Change password (authenticated)
auth.post('/change-password', authMiddleware, async (c) => {
  const body = await c.req.json();
  const parsed = changePasswordSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ success: false, error: parsed.error.errors[0]?.message }, 400);
  }

  const { currentPassword, newPassword } = parsed.data;
  const authUser = c.get('user');

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, authUser.id))
    .limit(1);

  if (!user) {
    return c.json({ success: false, error: 'Usuario nao encontrado' }, 404);
  }

  if (user.passwordHash !== hashPassword(currentPassword)) {
    return c.json({ success: false, error: 'Senha atual incorreta' }, 401);
  }

  await db
    .update(users)
    .set({
      passwordHash: hashPassword(newPassword),
      mustChangePassword: false,
      updatedAt: new Date(),
    })
    .where(eq(users.id, authUser.id));

  return c.json({ success: true, data: { message: 'Senha alterada com sucesso' } });
});

// Forgot password (public)
auth.post('/forgot-password', async (c) => {
  const body = await c.req.json();
  const email = body.email as string;

  if (!email) {
    return c.json({ success: false, error: 'Email obrigatorio' }, 400);
  }

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  // Always return success to prevent email enumeration
  if (!user || !user.isActive) {
    return c.json({ success: true, data: { message: 'Se o email estiver cadastrado, voce recebera um link' } });
  }

  const resetToken = randomBytes(32).toString('hex');
  const resetTokenExpiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  await db
    .update(users)
    .set({ resetToken, resetTokenExpiresAt, updatedAt: new Date() })
    .where(eq(users.id, user.id));

  // TODO: Send email with reset link
  // For now, log it to console (dev only)
  const resetUrl = `${c.req.header('Origin') ?? 'http://localhost:5173'}/reset-password?token=${resetToken}`;
  console.log(`[forgot-password] Reset link for ${email}: ${resetUrl}`);

  return c.json({ success: true, data: { message: 'Se o email estiver cadastrado, voce recebera um link' } });
});

// Reset password with token (public)
auth.post('/reset-password', async (c) => {
  const body = await c.req.json();
  const { token, newPassword } = body as { token: string; newPassword: string };

  if (!token || !newPassword) {
    return c.json({ success: false, error: 'Token e nova senha obrigatorios' }, 400);
  }

  if (newPassword.length < 6) {
    return c.json({ success: false, error: 'Senha deve ter no minimo 6 caracteres' }, 400);
  }

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.resetToken, token))
    .limit(1);

  if (!user) {
    return c.json({ success: false, error: 'Token invalido ou expirado' }, 400);
  }

  if (!user.resetTokenExpiresAt || user.resetTokenExpiresAt < new Date()) {
    return c.json({ success: false, error: 'Token expirado' }, 400);
  }

  await db
    .update(users)
    .set({
      passwordHash: hashPassword(newPassword),
      resetToken: null,
      resetTokenExpiresAt: null,
      mustChangePassword: false,
      updatedAt: new Date(),
    })
    .where(eq(users.id, user.id));

  return c.json({ success: true, data: { message: 'Senha redefinida com sucesso' } });
});

auth.get('/me', authMiddleware, async (c) => {
  const user = c.get('user');
  return c.json({ success: true, data: user });
});

export { auth };

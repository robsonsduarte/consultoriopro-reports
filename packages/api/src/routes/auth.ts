import { Hono } from 'hono';
import jwt from 'jsonwebtoken';
const { sign } = jwt;
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { users } from '../db/schema.js';
import { loginSchema } from '@cpro/shared';
import { authMiddleware, type AuthEnv } from '../middleware/auth.js';
import { createHash } from 'node:crypto';

const JWT_SECRET = process.env.JWT_SECRET ?? 'cpro-dev-secret-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN ?? '4h';

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

auth.get('/me', authMiddleware, async (c) => {
  const user = c.get('user');
  return c.json({ success: true, data: user });
});

export { auth };

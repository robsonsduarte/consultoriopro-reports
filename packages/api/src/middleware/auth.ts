import { createMiddleware } from 'hono/factory';
import jwt from 'jsonwebtoken';
import type { AuthUser, UserRole } from '@cpro/shared';

const { verify } = jwt;

const JWT_SECRET = process.env.JWT_SECRET ?? 'cpro-dev-secret-change-in-production';

export interface AuthEnv {
  Variables: {
    user: AuthUser;
  };
}

export const authMiddleware = createMiddleware<AuthEnv>(async (c, next) => {
  const header = c.req.header('Authorization');

  if (!header?.startsWith('Bearer ')) {
    return c.json({ success: false, error: 'Token ausente' }, 401);
  }

  const token = header.slice(7);

  try {
    const payload = verify(token, JWT_SECRET) as AuthUser;
    c.set('user', payload);
    await next();
  } catch {
    return c.json({ success: false, error: 'Token invalido' }, 401);
  }
});

export const requireRole = (...roles: UserRole[]) =>
  createMiddleware<AuthEnv>(async (c, next) => {
    const user = c.get('user');

    if (!roles.includes(user.role)) {
      return c.json({ success: false, error: 'Permissao negada' }, 403);
    }

    await next();
  });
